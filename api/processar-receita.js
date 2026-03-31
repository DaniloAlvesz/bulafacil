export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { imagem } = req.body;
  if (!imagem) {
    return res.status(400).json({ error: 'Nenhuma imagem foi enviada no payload.' });
  }

  const prompt = `Você é um farmacêutico clínico especialista em letramento em saúde pública. Leia a imagem desta receita médica ou bula. Retorne APENAS um objeto JSON. Regras: 1. ZERO ALUCINAÇÃO: Se a caligrafia estiver ilegível, não adivinhe. 2. Não altere a prescrição. O JSON deve ter a estrutura: { "status": "sucesso" ou "erro", "mensagem_erro": "Preencha apenas se houver erro ou ilegibilidade. Se for sucesso, deixe vazio.", "medicamentos": [ { "nome": "Nome e concentração", "para_que_serve": "Explicação em 1 frase simples", "como_tomar": "Instrução hiper simplificada", "alerta": "O principal aviso de segurança" } ] }`;

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
      console.warn("Modelo principal 17b falhou. Tentando modelo de fallback 90b...");
      response = await performFetch("llama-3.2-90b-vision-instruct");
    }

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
