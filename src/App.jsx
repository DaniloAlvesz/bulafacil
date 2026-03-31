import React, { useState, useRef } from 'react';
import { Camera, AlertTriangle, Loader2, Pill, Clock, Phone, AlertCircle } from 'lucide-react';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [apiResult, setApiResult] = useState(null);

  const fileInputRef = useRef(null);

  const handleCameraClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setIsModalOpen(true);
      setIsDisclaimerAccepted(false);
    }
    e.target.value = '';
  };

  const handleContinue = () => {
    if (!isDisclaimerAccepted || !selectedFile) return;

    setIsLoading(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = reader.result;
        // Keep the complete base64 string including data:image/...

        const prompt = `Você é um farmacêutico clínico especialista em letramento em saúde pública. Leia a imagem desta receita médica ou bula. Retorne APENAS um objeto JSON. Regras: 1. ZERO ALUCINAÇÃO: Se a caligrafia estiver ilegível, não adivinhe. 2. Não altere a prescrição. O JSON deve ter a estrutura: { "status": "sucesso" ou "erro", "mensagem_erro": "Preencha apenas se houver erro ou ilegibilidade. Se for sucesso, deixe vazio.", "medicamentos": [ { "nome": "Nome e concentração", "para_que_serve": "Explicação em 1 frase simples", "como_tomar": "Instrução hiper simplificada", "alerta": "O principal aviso de segurança" } ] }`;

        const makePayload = (modelName) => ({
          model: modelName,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: base64String } }
              ]
            }
          ],
          temperature: 0.1,
          max_completion_tokens: 1024,
          top_p: 1,
          stream: false,
          response_format: { type: "json_object" }
        });

        const apiKey = import.meta.env.VITE_GROQ_API_KEY;
        
        const performFetch = async (modelName) => {
          return await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(makePayload(modelName))
          });
        };

        let response = await performFetch("meta-llama/llama-4-scout-17b-16e-instruct");

        if (!response.ok) {
          console.warn("Modelo principal falhou. Tentando modelo de fallback 90b...");
          response = await performFetch("llama-3.2-90b-vision-instruct");
        }

        if (!response.ok) {
          const errData = await response.text();
          throw new Error(`Groq HTTP error! status: ${response.status} - ${errData}`);
        }

        const data = await response.json();
        const contentStr = data.choices[0].message.content;

        let cleanText = contentStr.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(cleanText);
        setApiResult(parsedData);

        setIsLoading(false);
        setIsModalOpen(false);
        setShowResults(true);

      } catch (error) {
        console.error("Erro da API Groq:", error);
        setApiResult({
          status: "erro",
          mensagem_erro: `Ocorreu um erro na API Groq: ${error.message}`
        });
        setIsLoading(false);
        setIsModalOpen(false);
        setShowResults(true);
      }
    };

    reader.readAsDataURL(selectedFile);
  };

  const handleRestart = () => {
    setShowResults(false);
    setApiResult(null);
    setSelectedFile(null);
  };

  const MainContainer = ({ children }) => (
    <div className="min-h-screen bg-blue-900 font-sans text-white overflow-x-hidden">
      <div className="min-h-screen w-full max-w-md mx-auto flex flex-col px-6 py-6 gap-6 box-border relative">
        {children}
      </div>
    </div>
  );

  // 1. Loading State
  if (isLoading) {
    return (
      <MainContainer>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
          <Loader2 size={64} className="text-white animate-spin" />
          <p className="text-2xl font-medium text-wrap break-words leading-snug">
            Analisando a prescrição...<br />Isso pode levar alguns segundos.
          </p>
        </div>
      </MainContainer>
    );
  }

  // 2. Results State
  if (showResults && apiResult) {
    return (
      <MainContainer>
        <header className="w-full text-center shrink-0">
          <h1 className="text-3xl font-bold tracking-tight text-wrap break-words">Resultado da Leitura</h1>
        </header>

        <main className="flex-1 w-full flex flex-col gap-8">

          {apiResult.status === "erro" ? (
            <div className="w-full bg-[#FFF4E5] border-4 border-red-500 rounded-2xl p-6 shadow-xl flex flex-col items-center text-center gap-4 box-border break-words mt-4">
              <AlertCircle size={64} className="text-red-600" />
              <h2 className="text-2xl font-bold text-red-700 uppercase tracking-wide text-wrap">Atenção!</h2>
              <p className="text-xl font-medium text-red-950 leading-snug text-wrap">
                {apiResult.mensagem_erro}
              </p>
            </div>
          ) : (
            apiResult.medicamentos?.map((med, idx) => (
              <div key={idx} className="flex flex-col gap-4">
                {/* Card 1: Remédio */}
                <div className="w-full bg-white rounded-2xl p-5 shadow-lg flex items-start gap-4 relative overflow-hidden box-border break-words">
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-blue-500"></div>
                  <div className="bg-blue-100 p-3 rounded-full shrink-0">
                    <Pill size={32} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1 text-wrap">Remédio {idx + 1}</h2>
                    <p className="text-2xl font-bold text-gray-900 mb-1 text-wrap">{med.nome}</p>
                    <p className="text-base font-medium text-gray-700 leading-snug text-wrap">{med.para_que_serve}</p>
                  </div>
                </div>

                {/* Card 2: Como tomar */}
                <div className="w-full bg-white rounded-2xl p-5 shadow-lg flex items-start gap-4 relative overflow-hidden box-border break-words">
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-green-500"></div>
                  <div className="bg-green-100 p-3 rounded-full shrink-0">
                    <Clock size={32} className="text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1 text-wrap">Como tomar</h2>
                    <p className="text-xl font-bold text-gray-900 mb-1 text-wrap">{med.como_tomar}</p>
                  </div>
                </div>

                {/* Card 3: Atenção */}
                <div className="w-full bg-[#FFF4E5] border-2 border-[#FFD29D] rounded-2xl p-5 shadow-lg flex items-start gap-4 relative overflow-hidden box-border break-words">
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-orange-500"></div>
                  <div className="bg-orange-200 p-3 rounded-full shrink-0">
                    <AlertTriangle size={32} className="text-orange-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold text-orange-800 uppercase tracking-wide mb-1 text-wrap">Atenção</h2>
                    <p className="text-lg font-bold text-orange-950 leading-snug text-wrap">
                      {med.alerta}
                    </p>
                  </div>
                </div>

                {/* Visual separation if there's more than one medication */}
                {idx < apiResult.medicamentos.length - 1 && (
                  <hr className="my-4 border-blue-400 opacity-50 border-t-2 border-dashed" />
                )}
              </div>
            ))
          )}

        </main>

        <footer className="w-full flex flex-col gap-4 shrink-0 mt-6">
          <button
            onClick={handleRestart}
            className="w-full bg-[#FF7A00] hover:bg-[#E06B00] active:bg-[#CC6200] transition-colors rounded-xl flex items-center justify-center shadow-lg ring-4 ring-transparent focus:ring-yellow-400 outline-none text-center py-4 box-border break-words"
          >
            <span className="text-xl font-bold uppercase tracking-wide text-wrap">
              {apiResult.status === "erro" ? "Tentar Novamente" : "Ler outra receita"}
            </span>
          </button>

          <a
            href="tel:192"
            className="w-full bg-blue-800 hover:bg-blue-700 transition-colors border-2 border-blue-400 rounded-xl flex items-center justify-center gap-3 shadow-md outline-none focus:ring-4 focus:ring-blue-300 decoration-transparent text-center py-4 px-4 box-border break-words"
          >
            <Phone size={24} className="text-blue-200 shrink-0" />
            <span className="text-lg font-bold text-white tracking-wide text-wrap min-w-0">Dúvidas? Ligue para o SAMU (192)</span>
          </a>
        </footer>
      </MainContainer>
    );
  }

  // 3. Normal State (Home)
  return (
    <MainContainer>
      <header className="w-full text-center shrink-0">
        <h1 className="text-3xl font-bold tracking-tight text-wrap break-words uppercase">BULA FÁCIL</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full gap-8 relative">
        <div className="text-center">
          <p className="text-xl font-medium leading-snug text-wrap break-words">
            Entenda o seu medicamento<br />de forma simples.
          </p>
        </div>

        <div className="w-full flex flex-col items-center gap-4">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleCameraClick}
            className="w-full bg-[#FF7A00] hover:bg-[#E06B00] active:bg-[#CC6200] transition-colors rounded-2xl flex flex-col items-center justify-center shadow-lg ring-4 ring-transparent focus:ring-yellow-400 outline-none text-center py-6 gap-3 box-border break-words"
            aria-label="Tirar foto da receita ou bula"
          >
            <Camera size={36} className="text-white" />
            <span className="text-xl font-bold uppercase tracking-wide text-wrap px-2">Tirar Foto da Receita ou Bula</span>
          </button>

          <p className="text-sm text-blue-200 text-center px-4 leading-normal text-wrap break-words">
            Sua foto não será salva no nosso sistema.
          </p>
        </div>
      </main>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-blue-900/95 flex flex-col justify-end z-50 overflow-x-hidden p-0 font-sans text-white backdrop-blur-sm">
          <div className="w-full min-h-screen max-w-md mx-auto flex flex-col px-6 py-6 gap-6 justify-center">

            <div className="flex flex-col items-center text-center gap-4 shrink-0">
              <AlertTriangle size={64} className="text-red-500" />
              <h2 className="text-3xl font-bold text-red-500 uppercase tracking-wide text-wrap break-words">
                Aviso Importante!
              </h2>
            </div>

            <div className="bg-white text-blue-950 p-6 rounded-2xl shadow-xl w-full box-border break-words flex flex-col gap-6">
              <p className="text-lg leading-relaxed font-medium text-wrap">
                Este aplicativo usa inteligência artificial para facilitar a leitura. Ele <strong>NÃO</strong> substitui a avaliação de um médico, enfermeiro ou farmacêutico. Em caso de dúvida, procure o posto de saúde.
              </p>

              <label className="flex items-start gap-4 cursor-pointer p-4 bg-gray-50 border-2 border-gray-200 rounded-xl hover:bg-gray-100 transition-colors w-full box-border">
                <input
                  type="checkbox"
                  className="w-8 h-8 shrink-0 mt-1 accent-blue-600 rounded bg-white outline-none focus:ring-4 focus:ring-blue-300"
                  checked={isDisclaimerAccepted}
                  onChange={(e) => setIsDisclaimerAccepted(e.target.checked)}
                />
                <span className="text-base font-bold text-gray-800 leading-tight text-wrap min-w-0">
                  Li e entendi que este app não substitui um profissional de saúde.
                </span>
              </label>
            </div>

            <div className="w-full flex flex-col gap-4 shrink-0">
              <button
                onClick={handleContinue}
                disabled={!isDisclaimerAccepted}
                className={`w-full text-center py-4 rounded-xl text-xl font-bold uppercase tracking-wider transition-all duration-300 box-border break-words ${isDisclaimerAccepted ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg ring-4 ring-transparent focus:ring-green-300' : 'bg-gray-400 text-gray-200 cursor-not-allowed'}`}
              >
                Continuar
              </button>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-full text-center py-4 rounded-xl text-lg font-bold text-white bg-transparent border-2 border-blue-400 hover:bg-blue-800 transition-colors box-border break-words"
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}
    </MainContainer>
  );
}

export default App;
