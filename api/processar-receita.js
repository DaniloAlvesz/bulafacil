export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { imagem, tipo } = req.body;
  if (!imagem) {
    return res.status(400).json({ status: 'erro', mensagem_erro: 'Nenhuma imagem foi enviada no payload.' });
  }

  const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (tipo && !tiposPermitidos.includes(tipo.toLowerCase())) {
    return res.status(400).json({ status: 'erro', mensagem_erro: 'Formato de imagem não suportado. Use JPEG, PNG ou WEBP.' });
  }

  const prompt = `Você é um farmacêutico clínico especialista em letramento em saúde pública e comunicação acessível. Analise rigorosamente a imagem desta receita médica ou bula.
Regras inegociáveis:
1. ZERO ALUCINAÇÃO: Se a caligrafia estiver ilegível, incompleta ou ambígua, não adivinhe. Preencha o campo "status" como "erro" e informe o problema no "mensagem_erro".
2. IMPARCIALIDADE: Baseie-se exclusivamente em diretrizes clínicas padrão sem viés comercial ou julgamento.
3. ACESSIBILIDADE: Use linguagem hiper simplificada, direcionada a leigos, sem jargões.
4. Retorne APENAS um objeto JSON válido, sem markdown extra.
Estrutura exigida do JSON:
{
  "status": "sucesso" ou "erro",
  "mensagem_erro": "Preencha apenas se houver erro ou ilegibilidade crítica. Se for sucesso, deixe vazio.",
  "medicamentos": [
    {
      "nome": "Nome do medicamento e concentração",
      "para_que_serve": "Explicação em 1 frase muito simples e direta.",
      "como_tomar": "Instrução hiper simplificada de dosagem e frequência.",
      "tempo_tratamento": "Duração do tratamento (ex: 7 dias) ou 'Não informado/Uso contínuo'.",
      "relacao_alimentos": "Orientação sobre jejum, refeições ou alimentos a evitar.",
      "esquecimento_dose": "O que o paciente deve fazer se esquecer de tomar uma dose.",
      "efeitos_colaterais": "Principais efeitos colaterais comuns e esperados.",
      "sintomas_alerta": "Sintomas de alerta ou efeitos graves para buscar ajuda médica imediata.",
      "riscos_uso_incorreto": "Explicação detalhada sobre o que o uso inadequado, abusivo ou superdosagem deste medicamento pode ocasionar no corpo.",
      "alerta": "Principal aviso de segurança ou contraindicação crítica."
    }
  ]
}`;

  const makePayload = (modelName) => ({
    model: modelName,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imagem } }
        ]
      }
    ],
    temperature: 0.1,
    max_completion_tokens: 1024,
    top_p: 1,
    stream: false,
    response_format: { type: "json_object" }
  });

  const performFetch = async (modelName) => {
    return await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(makePayload(modelName))
    });
  };

  try {
    let response = await performFetch("meta-llama/llama-4-scout-17b-16e-instruct");

    if (!response.ok) {
      const errData = await response.text();
      throw new Error(`Groq HTTP error! status: ${response.status} - ${errData}`);
    }

    const data = await response.json();
    const contentStr = data.choices[0].message.content;
    
    // Pure extraction mapping directly to front-end constraints
    let cleanText = contentStr.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanText);

    return res.status(200).json(parsedData);

  } catch (error) {
    console.error("Vercel Function API Error:", error);
    return res.status(500).json({
      status: "erro",
      mensagem_erro: `Ocorreu um erro no servidor Vercel: ${error.message}`
    });
  }
}
