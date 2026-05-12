import React, { useState, useRef, useEffect } from 'react';
import { Camera, AlertTriangle, Loader2, Pill, Clock, Phone, AlertCircle, Utensils, Activity, AlertOctagon, HelpCircle, Calendar, ShieldAlert, Volume2, Square, Download, X, Share2, ChevronRight } from 'lucide-react';

// ── Design Tokens ────────────────────────────────────────────────────────────
// Tipografia unificada: Inter, tamanhos fixos para consistência
// título de card:  text-xs  font-semibold uppercase tracking-widest  (label)
// corpo de card:   text-sm  font-medium  leading-relaxed              (content)
// nome remédio:    text-xl  font-bold                                 (heading)
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  const [isDisclaimerAccepted, setIsDisclaimerAccepted] = useState(() =>
    localStorage.getItem('isDisclaimerAccepted') === 'true'
  );
  const [isDisclaimerModalOpen, setIsDisclaimerModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [apiResult, setApiResult] = useState(null);
  const [speakingId, setSpeakingId] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const fileInputRef = useRef(null);
  const [historico, setHistorico] = useState(() => {
    try { return JSON.parse(localStorage.getItem('bula_historico') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    const timer = setTimeout(() => setShowInstallPrompt(true), 2000);
    const handleBIP = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    const handleInstalled = () => { setShowInstallPrompt(false); setDeferredPrompt(null); };
    window.addEventListener('beforeinstallprompt', handleBIP);
    window.addEventListener('appinstalled', handleInstalled);
    return () => { clearTimeout(timer); window.removeEventListener('beforeinstallprompt', handleBIP); window.removeEventListener('appinstalled', handleInstalled); };
  }, []);

  useEffect(() => { return () => window.speechSynthesis.cancel(); }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && fileInputRef.current?.files?.length > 0) {
        processFile(fileInputRef.current.files[0]);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("Toque no menu do navegador e escolha 'Adicionar à tela inicial'.");
      setShowInstallPrompt(false);
      return;
    }
    setShowInstallPrompt(false);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleSpeak = (text, id) => {
    window.speechSynthesis.cancel();
    if (speakingId === id) { setSpeakingId(null); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'pt-BR';
    u.onend = () => setSpeakingId(null);
    u.onerror = () => setSpeakingId(null);
    setSpeakingId(id);
    window.speechSynthesis.speak(u);
  };

  // Botão de áudio padronizado
  const SpeechButton = ({ text, id }) => (
    <button
      onClick={() => handleSpeak(text, id)}
      className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors outline-none hover:bg-black/8 focus:ring-2 focus:ring-blue-300"
      aria-label="Ouvir"
    >
      {speakingId === id
        ? <Square size={16} className="text-red-500" />
        : <Volume2 size={16} className="text-gray-400" />}
    </button>
  );

  const handleStartFlow = () => {
    if (isDisclaimerAccepted) triggerNativeCamera();
    else setIsDisclaimerModalOpen(true);
  };

  const handleDisclaimerContinue = () => {
    if (!isDisclaimerAccepted) return;
    localStorage.setItem('isDisclaimerAccepted', 'true');
    setIsDisclaimerModalOpen(false);
    triggerNativeCamera();
  };

  const triggerNativeCamera = () => {
    setShowResults(false);
    setApiResult(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) processFile(f);
  };

  const processFile = (file) => {
    setIsLoading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (fileInputRef.current) fileInputRef.current.value = '';
      submitData(reader.result, file.type);
    };
    reader.readAsDataURL(file);
  };

  const salvarNoHistorico = (resultado) => {
    try {
      const hist = JSON.parse(localStorage.getItem('bula_historico') || '[]');
      const entrada = {
        id: Date.now(),
        data: new Date().toLocaleDateString('pt-BR'),
        nomes: resultado.medicamentos?.map(m => m.nome).join(', ') || 'Desconhecido',
        dados: resultado,
      };
      const atualizado = [entrada, ...hist].slice(0, 5);
      localStorage.setItem('bula_historico', JSON.stringify(atualizado));
      setHistorico(atualizado);
    } catch {}
  };

  const handleShare = async () => {
    if (!apiResult?.medicamentos) return;
    const texto = apiResult.medicamentos.map((m, i) =>
      `Remédio ${i + 1}: ${m.nome}\nComo tomar: ${m.como_tomar}\nAtenção: ${m.alerta}`
    ).join('\n\n---\n\n');
    const shareData = { title: 'Bula Fácil — Resultado', text: `Resultado da sua receita:\n\n${texto}\n\nGerado pelo Bula Fácil` };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(shareData.text);
      alert('Resultado copiado para a área de transferência!');
    }
  };

  const submitData = async (base64String, fileType) => {
    try {
      const res = await fetch('/api/processar-receita', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagem: base64String, tipo: fileType }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsedData = await res.json();
      if (parsedData.status === 'sucesso') salvarNoHistorico(parsedData);
      setApiResult(parsedData);
      setIsLoading(false);
      setShowResults(true);
    } catch (err) {
      console.error(err);
      setApiResult({ status: 'erro', mensagem_erro: `Erro de conexão com o servidor: ${err.message}` });
      setIsLoading(false);
      setShowResults(true);
    }
  };

  const handleRestart = () => { setShowResults(false); setApiResult(null); };

  // ── Componente: Card de informação padronizado ─────────────────────────────
  const InfoCard = ({ icon, label, labelColor, headerBg, borderColor, children, audioText, audioId, prominent = false }) => (
    <div className={`w-full bg-white flex flex-col overflow-hidden border ${borderColor} ${prominent ? 'rounded-2xl shadow-md' : 'rounded-xl shadow-sm'}`}>
      <div className={`${headerBg} flex items-center justify-between px-4 py-3 border-b ${borderColor}`}>
        <div className="flex items-center gap-2.5">
          <span className={`shrink-0 ${labelColor}`}>{icon}</span>
          <span className={`text-xs font-bold uppercase tracking-widest ${labelColor}`}>{label}</span>
        </div>
        <SpeechButton text={audioText} id={audioId} />
      </div>
      <div className="px-4 py-4">
        {children}
      </div>
    </div>
  );

  // ── Skeleton Loader ────────────────────────────────────────────────────────
  const SkeletonCard = ({ lines = 2 }) => (
    <div className="w-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-4 h-4 rounded bg-gray-200" />
        <div className="h-3 w-28 rounded bg-gray-200" />
      </div>
      <div className="px-4 py-4 flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={`h-3 rounded bg-gray-100 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );

  // ── Shell ──────────────────────────────────────────────────────────────────
  const Shell = ({ children }) => (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-blue-950 font-sans text-white overflow-x-hidden">
      <div className="min-h-screen w-full max-w-md mx-auto flex flex-col px-4 pt-6 pb-8 gap-5 box-border">
        {children}
      </div>

      {showInstallPrompt && (
        <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 z-50 flex justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md flex flex-col gap-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2.5 rounded-xl text-white">
                  <Download size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Instalar Bula Fácil</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">Acesse direto da tela inicial.</p>
                </div>
              </div>
              <button onClick={() => setShowInstallPrompt(false)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>
            {isIOS && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-xs text-blue-800 font-medium leading-relaxed">
                No iPhone: toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowInstallPrompt(false)} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                Agora não
              </button>
              {!isIOS && (
                <button onClick={handleInstallClick} className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                  Instalar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── View: Loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Shell>
        <header className="text-center shrink-0 pt-2">
          <h1 className="text-xl font-bold text-white">Analisando...</h1>
          <p className="text-xs font-medium text-blue-300/80 mt-1">A IA está lendo o documento</p>
        </header>
        <main className="flex-1 flex flex-col gap-3">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={1} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={1} />
          <SkeletonCard lines={2} />
        </main>
      </Shell>
    );
  }

  // ── View: Results ──────────────────────────────────────────────────────────
  if (showResults && apiResult) {
    return (
      <Shell>
        <header className="text-center shrink-0 pt-2">
          <h1 className="text-xl font-bold text-white">Resultado da Leitura</h1>
          <p className="text-xs font-medium text-blue-300/80 mt-1">Toque no ícone de áudio para ouvir cada seção</p>
        </header>

        <main className="flex-1 flex flex-col gap-4">
          {apiResult.status === 'erro' ? (
            <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-red-100">
              <div className="bg-red-50 flex flex-col items-center text-center gap-3 px-5 py-6 border-b border-red-100">
                <div className="bg-red-100 p-3 rounded-full text-red-600">
                  <AlertCircle size={32} />
                </div>
                <p className="text-sm font-bold text-red-800 uppercase tracking-widest">Não foi possível ler</p>
              </div>
              <div className="px-5 py-5 flex flex-col gap-4">
                <p className="text-sm font-medium text-gray-700 leading-relaxed text-center">{apiResult.mensagem_erro}</p>
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <p className="text-xs font-bold text-blue-800 mb-2">Dicas para uma boa foto:</p>
                  <ul className="text-xs text-blue-700 space-y-1 font-medium">
                    <li>• Boa iluminação, sem sombras sobre o texto</li>
                    <li>• Câmera estável e focada na receita</li>
                    <li>• Papel sem dobras ou amassados</li>
                    <li>• Todo o texto deve estar visível na foto</li>
                  </ul>
                </div>
                <button
                  onClick={handleRestart}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all rounded-xl text-sm font-bold text-white uppercase tracking-wide"
                >
                  Tentar com outra foto
                </button>
              </div>
            </div>
          ) : (
            apiResult.medicamentos?.map((med, idx) => (
              <div key={idx} className="flex flex-col gap-3">

                {/* Card: Nome e finalidade */}
                <InfoCard
                  icon={<Pill size={16} />}
                  label={`Remédio ${idx + 1}`}
                  labelColor="text-blue-700"
                  headerBg="bg-blue-50"
                  borderColor="border-blue-100"
                  audioText={`Remédio ${idx + 1}. ${med.nome}. Para que serve: ${med.para_que_serve}`}
                  audioId={`med-${idx}-intro`}
                  prominent
                >
                  <p className="text-lg font-bold text-gray-900 leading-snug mb-1">{med.nome}</p>
                  <p className="text-sm font-medium text-gray-600 leading-relaxed">{med.para_que_serve}</p>
                </InfoCard>

                {/* Card: Como tomar */}
                <InfoCard
                  icon={<Clock size={16} />}
                  label="Como Tomar"
                  labelColor="text-green-700"
                  headerBg="bg-green-50"
                  borderColor="border-green-100"
                  audioText={`Como tomar: ${med.como_tomar}`}
                  audioId={`med-${idx}-comotomar`}
                  prominent
                >
                  <p className="text-sm font-semibold text-gray-800 leading-relaxed">{med.como_tomar}</p>
                </InfoCard>

                {/* Card: Duração */}
                {med.tempo_tratamento && !med.tempo_tratamento.toLowerCase().includes('não informado') && (
                  <InfoCard
                    icon={<Calendar size={16} />}
                    label="Duração"
                    labelColor="text-violet-700"
                    headerBg="bg-violet-50"
                    borderColor="border-violet-100"
                    audioText={`Duração: ${med.tempo_tratamento}`}
                    audioId={`med-${idx}-tempo`}
                  >
                    <p className="text-sm font-medium text-gray-800 leading-relaxed">{med.tempo_tratamento}</p>
                  </InfoCard>
                )}

                {/* Card: Alimentos */}
                {med.relacao_alimentos && (
                  <InfoCard
                    icon={<Utensils size={16} />}
                    label="Alimentação"
                    labelColor="text-teal-700"
                    headerBg="bg-teal-50"
                    borderColor="border-teal-100"
                    audioText={`Alimentação: ${med.relacao_alimentos}`}
                    audioId={`med-${idx}-alimentos`}
                  >
                    <p className="text-sm font-medium text-gray-800 leading-relaxed">{med.relacao_alimentos}</p>
                  </InfoCard>
                )}

                {/* Card: Esquecimento */}
                {med.esquecimento_dose && (
                  <InfoCard
                    icon={<HelpCircle size={16} />}
                    label="Se Esquecer"
                    labelColor="text-gray-600"
                    headerBg="bg-gray-50"
                    borderColor="border-gray-200"
                    audioText={`Se esquecer a dose: ${med.esquecimento_dose}`}
                    audioId={`med-${idx}-esquecimento`}
                  >
                    <p className="text-sm font-medium text-gray-800 leading-relaxed">{med.esquecimento_dose}</p>
                  </InfoCard>
                )}

                {/* Card: Efeitos comuns */}
                {med.efeitos_colaterais && (
                  <InfoCard
                    icon={<Activity size={16} />}
                    label="Efeitos Comuns"
                    labelColor="text-amber-700"
                    headerBg="bg-amber-50"
                    borderColor="border-amber-100"
                    audioText={`Efeitos colaterais: ${med.efeitos_colaterais}`}
                    audioId={`med-${idx}-efeitos`}
                  >
                    <p className="text-sm font-medium text-gray-800 leading-relaxed">{med.efeitos_colaterais}</p>
                  </InfoCard>
                )}

                {/* Card: Sintomas de alerta */}
                {med.sintomas_alerta && (
                  <InfoCard
                    icon={<AlertOctagon size={16} />}
                    label="Sintomas de Alerta"
                    labelColor="text-red-700"
                    headerBg="bg-red-50"
                    borderColor="border-red-200"
                    audioText={`Sintomas de alerta: ${med.sintomas_alerta}`}
                    audioId={`med-${idx}-sintomasalerta`}
                    prominent
                  >
                    <p className="text-sm font-medium text-red-900 leading-relaxed">{med.sintomas_alerta}</p>
                  </InfoCard>
                )}

                {/* Card: Riscos */}
                {med.riscos_uso_incorreto && (
                  <InfoCard
                    icon={<ShieldAlert size={16} />}
                    label="Riscos do Uso Incorreto"
                    labelColor="text-red-800"
                    headerBg="bg-red-100/60"
                    borderColor="border-red-200"
                    audioText={`Riscos: ${med.riscos_uso_incorreto}`}
                    audioId={`med-${idx}-riscos`}
                  >
                    <p className="text-sm font-medium text-red-950 leading-relaxed">{med.riscos_uso_incorreto}</p>
                  </InfoCard>
                )}

                {/* Card: Atenção principal (destaque visual) */}
                <div className="w-full bg-amber-50 border-2 border-amber-300 rounded-2xl shadow-md overflow-hidden">
                  <div className="bg-amber-100 flex items-center justify-between px-4 py-3 border-b border-amber-200">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle size={16} className="text-amber-700 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-widest text-amber-800">Atenção Principal</span>
                    </div>
                    <SpeechButton text={`Atenção: ${med.alerta}`} id={`med-${idx}-atencao`} />
                  </div>
                  <div className="px-4 py-4">
                    <p className="text-sm font-semibold text-amber-900 leading-relaxed">{med.alerta}</p>
                  </div>
                </div>

                {idx < apiResult.medicamentos.length - 1 && (
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-xs font-medium text-blue-300/60 uppercase tracking-widest">próximo remédio</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                )}
              </div>
            ))
          )}
        </main>

        <footer className="flex flex-col gap-3 shrink-0 pt-2">
          <button
            onClick={handleRestart}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all rounded-2xl text-sm font-bold text-white uppercase tracking-wide shadow-lg shadow-blue-900/40"
          >
            {apiResult.status === 'erro' ? 'Tentar Novamente' : 'Ler nova receita'}
          </button>
          {apiResult.status !== 'erro' && (
            <button
              onClick={handleShare}
              className="w-full py-3.5 flex items-center justify-center gap-2.5 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors"
            >
              <Share2 size={16} className="text-blue-300 shrink-0" />
              <span className="text-sm font-semibold text-white">Compartilhar resultado</span>
            </button>
          )}
          <a
            href="tel:192"
            className="w-full py-3.5 flex items-center justify-center gap-2.5 border border-white/10 rounded-2xl hover:bg-white/5 transition-colors"
          >
            <Phone size={16} className="text-red-400 shrink-0" />
            <span className="text-sm font-semibold text-white">Emergência — SAMU 192</span>
          </a>
        </footer>
      </Shell>
    );
  }

  // ── View: Home ─────────────────────────────────────────────────────────────
  return (
    <Shell>
      <header className="text-center shrink-0 pt-10 pb-2">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl mb-5">
          <Pill size={32} className="text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Bula Fácil</h1>
        <p className="text-sm font-medium text-blue-200/80 leading-relaxed max-w-[260px] mx-auto">
          Fotografe sua receita médica e entenda tudo de forma simples.
        </p>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center gap-5">
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
          capture="environment"
          style={{ display: 'none' }}
          id="cameraInput"
          ref={fileInputRef}
          onChange={handleFileChange}
        />

        <button
          onClick={handleStartFlow}
          className="w-full py-7 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all rounded-2xl flex flex-col items-center gap-3 shadow-xl shadow-blue-900/50 border border-blue-500/30 outline-none group"
          aria-label="Tirar foto da receita ou bula"
        >
          <div className="bg-white/10 group-hover:bg-white/20 transition-colors p-3.5 rounded-xl">
            <Camera size={32} className="text-white" />
          </div>
          <span className="text-base font-bold text-white tracking-wide">Fotografar Receita ou Bula</span>
        </button>

        <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-full">
          <ShieldAlert size={14} className="text-blue-300 shrink-0" />
          <p className="text-xs font-medium text-blue-200/70">Sua foto não é salva em nossos servidores.</p>
        </div>

        {historico.length > 0 && (
          <div className="w-full flex flex-col gap-2 pt-2">
            <p className="text-xs font-bold text-blue-300/70 uppercase tracking-widest px-1">Leituras recentes</p>
            {historico.map((item) => (
              <button
                key={item.id}
                onClick={() => { setApiResult(item.dados); setShowResults(true); }}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-white/10 transition-colors text-left"
              >
                <div className="bg-blue-600/20 p-2 rounded-lg shrink-0">
                  <Pill size={14} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{item.nomes}</p>
                  <p className="text-xs font-medium text-blue-300/60">{item.data}</p>
                </div>
                <ChevronRight size={14} className="text-blue-400/50 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Modal: Disclaimer */}
      {isDisclaimerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center px-4 pb-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-red-50 px-5 py-5 flex items-center gap-3 border-b border-red-100">
              <div className="bg-red-100 p-2.5 rounded-xl text-red-600 shrink-0">
                <AlertTriangle size={22} />
              </div>
              <h2 className="text-base font-bold text-red-900">Aviso Importante</h2>
            </div>

            <div className="px-5 py-5 flex flex-col gap-4">
              <p className="text-sm font-medium text-gray-700 leading-relaxed">
                Este app usa inteligência artificial para facilitar a leitura.
                Ele <strong className="text-red-600">NÃO</strong> substitui um médico, enfermeiro ou farmacêutico.
                Em dúvida, procure um posto de saúde.
              </p>

              <label className="flex items-start gap-3 cursor-pointer p-3.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-colors group">
                <input
                  type="checkbox"
                  className="w-5 h-5 shrink-0 mt-0.5 accent-blue-600 cursor-pointer"
                  checked={isDisclaimerAccepted}
                  onChange={(e) => setIsDisclaimerAccepted(e.target.checked)}
                />
                <span className="text-sm font-medium text-gray-800 leading-snug">
                  Li e entendi que este app não substitui um profissional de saúde.
                </span>
              </label>
            </div>

            <div className="px-5 pb-5 flex flex-col gap-2">
              <button
                onClick={handleDisclaimerContinue}
                disabled={!isDisclaimerAccepted}
                className={`w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-wide transition-all ${
                  isDisclaimerAccepted
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md active:scale-[0.98]'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                Continuar
              </button>
              <button
                onClick={() => setIsDisclaimerModalOpen(false)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

export default App;
