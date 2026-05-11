import React, { useState, useRef, useEffect } from 'react';
import { Camera, AlertTriangle, Loader2, Pill, Clock, Phone, AlertCircle, Utensils, Activity, AlertOctagon, HelpCircle, Calendar, ShieldAlert, Volume2, Square, Download, X } from 'lucide-react';

function App() {
  // --- Persistent States ---
  // If the OS killed the browser, we start the app automatically knowing if the user had accepted.
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(() => {
    return localStorage.getItem('isDisclaimerAccepted') === 'true';
  });
  
  // App States
  const [isDisclaimerModalOpen, setIsDisclaimerModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [apiResult, setApiResult] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);

  // --- PWA Install Prompt States ---
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      return; // Already installed, do nothing
    }

    // Check if iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Sempre mostrar a nossa caixa customizada após 2 segundos
    const timer = setTimeout(() => setShowInstallPrompt(true), 2000);

    // For Android / Chrome (Capturar o evento nativo se ele disparar)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Se não houver evento nativo (ex: acessando por HTTP no celular, ou sem manifest)
      // Mostra a instrução manual para Android
      alert("Para instalar agora: toque no menu do seu navegador (três pontinhos) e escolha 'Adicionar à tela inicial' ou 'Instalar aplicativo'.");
      setShowInstallPrompt(false);
      return;
    }
    setShowInstallPrompt(false);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleSpeak = (text, id) => {
    window.speechSynthesis.cancel();
    if (speakingId === id) {
      setSpeakingId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  const SpeechButton = ({ text, id }) => (
    <button 
      onClick={() => handleSpeak(text, id)}
      className="p-2 -mr-2 bg-transparent hover:bg-black/5 rounded-full shrink-0 transition-colors self-start outline-none focus:ring-2 focus:ring-blue-300"
      aria-label="Ouvir instrução"
    >
      {speakingId === id ? <Square size={22} className="text-red-500" /> : <Volume2 size={22} className="text-gray-400" />}
    </button>
  );

  const fileInputRef = useRef(null);

  // Recovery useEffect - If the page hard-reloads, check if the native input persisted the file 
  // (some mobile browsers preserve form states across OOM reloads).
  useEffect(() => {
    const handleVisibilityChange = () => {
       if (document.visibilityState === 'visible' && fileInputRef.current) {
         if (fileInputRef.current.files && fileInputRef.current.files.length > 0) {
            console.log("Arquivo recuperado após suspensão.");
            processFile(fileInputRef.current.files[0]);
         }
       }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Also check on immediate mount just in case
    if (fileInputRef.current && fileInputRef.current.files && fileInputRef.current.files.length > 0) {
       processFile(fileInputRef.current.files[0]);
    }

    return () => {
       document.removeEventListener("visibilitychange", handleVisibilityChange);
    }
  }, []);

  // 1. Initial Start Action
  const handleStartFlow = () => {
    if (isDisclaimerAccepted) {
       // If already accepted in previous session, go straight to camera
       triggerNativeCamera();
    } else {
       setIsDisclaimerModalOpen(true);
    }
  };

  // 2. Accept Disclaimer
  const handleDisclaimerContinue = () => {
    if (!isDisclaimerAccepted) return;
    
    // Persist confirmation to survive OOM kills
    localStorage.setItem('isDisclaimerAccepted', 'true');
    setIsDisclaimerModalOpen(false);
    
    triggerNativeCamera();
  };

  const triggerNativeCamera = () => {
    // Free up as much generic RAM layout as possible before the OS triggers the heavy camera app
    setShowResults(false);
    setApiResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    processFile(selectedFile);
  };

  const processFile = (file) => {
    setIsLoading(true);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      
      // Clear the input so it doesn't loop infinitely on future visibility changes
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; 
      }
      
      submitData(base64String);
    };
    reader.readAsDataURL(file);
  };

  // 4. Submit Base64
  const submitData = async (base64String) => {
    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      
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
        const errData = await response.text();
        throw new Error(`Groq HTTP error! status: ${response.status} - ${errData}`);
      }

      const data = await response.json();
      const contentStr = data.choices[0].message.content;
      
      const cleanText = contentStr.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanText);

      setApiResult(parsedData);
      setIsLoading(false);
      setShowResults(true);

    } catch (error) {
      console.error("Erro no Frontend ao conectar na API:", error);
      setApiResult({
        status: "erro",
        mensagem_erro: `Erro de rede ou servidor: ${error.message}`
      });
      setIsLoading(false);
      setShowResults(true);
    }
  };

  const handleRestart = () => {
    setShowResults(false);
    setApiResult(null);
  };

  const MainContainer = ({ children }) => (
    <div className="min-h-screen bg-blue-900 font-sans text-white overflow-x-hidden">
      <div className="min-h-screen w-full max-w-md mx-auto flex flex-col px-6 py-6 gap-6 box-border relative">
        {children}
      </div>

      {/* Modal de Instalação (PWA) */}
      {showInstallPrompt && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50 flex justify-center animate-in slide-in-from-bottom-10 fade-in duration-500 font-sans">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md flex flex-col gap-4 border border-gray-100">
            <div className="flex items-start justify-between">
              <div className="flex gap-3 items-center">
                <div className="bg-blue-600 p-2 rounded-xl text-white">
                  <Download size={24} />
                </div>
                <div>
                  <h3 className="text-gray-900 font-bold text-lg leading-tight">Instalar Bula Fácil</h3>
                  <p className="text-gray-500 text-sm">Adicione à sua tela inicial para acesso rápido.</p>
                </div>
              </div>
              <button onClick={() => setShowInstallPrompt(false)} className="text-gray-400 hover:text-gray-600 p-1 outline-none">
                <X size={20} />
              </button>
            </div>
            
            {isIOS && (
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                <p>No iPhone: Toque em <strong>Compartilhar</strong> (ícone do meio no rodapé) e depois em <strong>Adicionar à Tela de Início</strong>.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setShowInstallPrompt(false)} className="flex-1 py-3 text-gray-600 font-semibold text-sm bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors outline-none">
                Agora não
              </button>
              {!isIOS && (
                <button onClick={handleInstallClick} className="flex-1 py-3 text-white font-semibold text-sm bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-md outline-none">
                  Instalar App
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // VIEW: Loading State
  // Kept extremely lightweight (pure CSS SVG spin) to avoid overloading the CPU right after a memory crash
  if (isLoading) {
    return (
      <MainContainer>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
          <Loader2 size={64} className="text-white animate-spin" />
          <p className="text-2xl font-medium text-wrap break-words leading-snug">
            Analisando a prescrição...<br/>Isso pode levar alguns segundos.
          </p>
        </div>
      </MainContainer>
    );
  }

  // VIEW: Results State
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
                    <SpeechButton text={`Remédio ${idx + 1}. ${med.nome}. Para que serve: ${med.para_que_serve}`} id={`med-${idx}-intro`} />
                  </div>

                  <div className="w-full bg-white rounded-2xl p-5 shadow-lg flex items-start gap-4 relative overflow-hidden box-border break-words">
                    <div className="absolute left-0 top-0 bottom-0 w-2 bg-green-500"></div>
                    <div className="bg-green-100 p-3 rounded-full shrink-0">
                      <Clock size={32} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1 text-wrap">Como tomar</h2>
                      <p className="text-xl font-bold text-gray-900 mb-1 text-wrap">{med.como_tomar}</p>
                    </div>
                    <SpeechButton text={`Como tomar: ${med.como_tomar}`} id={`med-${idx}-comotomar`} />
                  </div>

                  {med.tempo_tratamento && med.tempo_tratamento.toLowerCase() !== "não informado" && (
                    <div className="w-full bg-white rounded-xl p-4 shadow-md flex items-start gap-3 relative overflow-hidden box-border break-words">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500"></div>
                      <div className="bg-purple-100 p-2 rounded-full shrink-0">
                        <Calendar size={24} className="text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 text-wrap">Tempo de Tratamento</h2>
                        <p className="text-base font-bold text-gray-800 text-wrap">{med.tempo_tratamento}</p>
                      </div>
                      <SpeechButton text={`Tempo de tratamento: ${med.tempo_tratamento}`} id={`med-${idx}-tempo`} />
                    </div>
                  )}

                  {med.relacao_alimentos && (
                    <div className="w-full bg-white rounded-xl p-4 shadow-md flex items-start gap-3 relative overflow-hidden box-border break-words">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-500"></div>
                      <div className="bg-teal-100 p-2 rounded-full shrink-0">
                        <Utensils size={24} className="text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 text-wrap">Alimentos</h2>
                        <p className="text-base font-bold text-gray-800 text-wrap">{med.relacao_alimentos}</p>
                      </div>
                      <SpeechButton text={`Relação com alimentos: ${med.relacao_alimentos}`} id={`med-${idx}-alimentos`} />
                    </div>
                  )}

                  {med.esquecimento_dose && (
                    <div className="w-full bg-white rounded-xl p-4 shadow-md flex items-start gap-3 relative overflow-hidden box-border break-words">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-400"></div>
                      <div className="bg-gray-100 p-2 rounded-full shrink-0">
                        <HelpCircle size={24} className="text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 text-wrap">Se Esquecer a Dose</h2>
                        <p className="text-base font-bold text-gray-800 text-wrap">{med.esquecimento_dose}</p>
                      </div>
                      <SpeechButton text={`O que fazer se esquecer a dose: ${med.esquecimento_dose}`} id={`med-${idx}-esquecimento`} />
                    </div>
                  )}

                  {med.efeitos_colaterais && (
                    <div className="w-full bg-white rounded-xl p-4 shadow-md flex items-start gap-3 relative overflow-hidden box-border break-words">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400"></div>
                      <div className="bg-yellow-100 p-2 rounded-full shrink-0">
                        <Activity size={24} className="text-yellow-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 text-wrap">Efeitos Comuns</h2>
                        <p className="text-base font-bold text-gray-800 text-wrap">{med.efeitos_colaterais}</p>
                      </div>
                      <SpeechButton text={`Efeitos colaterais comuns: ${med.efeitos_colaterais}`} id={`med-${idx}-efeitos`} />
                    </div>
                  )}

                  {med.sintomas_alerta && (
                    <div className="w-full bg-[#FFF4E5] border border-red-200 rounded-xl p-4 shadow-md flex items-start gap-3 relative overflow-hidden box-border break-words">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                      <div className="bg-red-100 p-2 rounded-full shrink-0">
                        <AlertOctagon size={24} className="text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xs font-bold text-red-800 uppercase tracking-wide mb-1 text-wrap">Sintomas de Alerta</h2>
                        <p className="text-base font-bold text-red-900 text-wrap">{med.sintomas_alerta}</p>
                      </div>
                      <SpeechButton text={`Sintomas de alerta graves: ${med.sintomas_alerta}`} id={`med-${idx}-sintomasalerta`} />
                    </div>
                  )}

                  {med.riscos_uso_incorreto && (
                    <div className="w-full bg-[#FFF0F0] border border-red-300 rounded-xl p-4 shadow-md flex items-start gap-3 relative overflow-hidden box-border break-words">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-700"></div>
                      <div className="bg-red-200 p-2 rounded-full shrink-0">
                        <ShieldAlert size={24} className="text-red-800" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-xs font-bold text-red-900 uppercase tracking-wide mb-1 text-wrap">Riscos do Uso Incorreto</h2>
                        <p className="text-base font-bold text-red-950 text-wrap leading-relaxed">{med.riscos_uso_incorreto}</p>
                      </div>
                      <SpeechButton text={`Riscos do uso incorreto: ${med.riscos_uso_incorreto}`} id={`med-${idx}-riscos`} />
                    </div>
                  )}

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
                    <SpeechButton text={`Atenção principal: ${med.alerta}`} id={`med-${idx}-atencao`} />
                  </div>
                  
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
            <span className="text-lg font-bold text-white tracking-wide text-wrap min-w-0">Em caso de emergência, ligue para o SAMU (192)</span>
          </a>
        </footer>
      </MainContainer>
    );
  }

  // VIEW: Normal State (Home)
  return (
    <MainContainer>
      <header className="w-full text-center shrink-0">
        <h1 className="text-3xl font-bold tracking-tight text-wrap break-words uppercase">BULA FÁCIL</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full gap-8 relative">
        <div className="text-center">
          <p className="text-xl font-medium leading-snug text-wrap break-words">
            Entenda o seu medicamento<br/>de forma simples.
          </p>
        </div>

        <div className="w-full flex flex-col items-center gap-4">
          <input 
            type="file" 
            accept="image/jpeg" 
            capture="environment" 
            style={{ display: 'none' }} 
            id="cameraInput"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <button 
            onClick={handleStartFlow}
            className="w-full bg-[#FF7A00] hover:bg-[#E06B00] active:bg-[#CC6200] transition-transform active:scale-95 rounded-2xl flex flex-col items-center justify-center shadow-lg ring-4 ring-transparent focus:ring-yellow-400 outline-none text-center py-6 gap-3 box-border break-words"
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

      {/* Modal Overlay: Disclaimer */}
      {isDisclaimerModalOpen && (
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
                onClick={handleDisclaimerContinue}
                disabled={!isDisclaimerAccepted}
                className={`w-full text-center py-4 rounded-xl text-xl font-bold uppercase tracking-wider transition-all duration-300 box-border break-words ${isDisclaimerAccepted ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg ring-4 ring-transparent focus:ring-green-300' : 'bg-gray-400 text-gray-200 cursor-not-allowed'}`}
              >
                Continuar
              </button>

              <button 
                onClick={() => setIsDisclaimerModalOpen(false)}
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
