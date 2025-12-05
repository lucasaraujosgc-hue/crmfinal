
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, Upload, MessageCircle, Bot, Settings, Menu, FileSpreadsheet, Search, Filter,
  CheckCircle2, AlertCircle, Send, RefreshCw, Megaphone, BookOpen, Plus, Power, Trash2, Terminal,
  Briefcase, AlertTriangle, MessageSquare, User, MoreVertical, Paperclip, Smile, Play, FileText, X, Save, Mic
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { CompanyResult, Status, CampaignStatus, KnowledgeRule, AIConfig, WhatsAppSession, ImportBatch, Instruction } from './types';
import { DEFAULT_KNOWLEDGE_RULES, DEFAULT_AI_PERSONA } from './constants';

// --- Custom Hooks ---

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed }: { icon: any, label: string, active: boolean, onClick: () => void, collapsed: boolean }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-xl mb-1
      ${active 
        ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }
      ${collapsed ? 'justify-center px-2' : ''}
    `}
  >
    <Icon size={20} className={active ? 'text-white' : 'text-slate-400'} />
    {!collapsed && <span>{label}</span>}
    {active && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />}
  </button>
);

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="relative overflow-hidden bg-white border border-slate-100 p-6 rounded-2xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.05)] group hover:-translate-y-1 transition-all duration-300">
    <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
      <Icon size={64} />
    </div>
    <div className="relative z-10">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
          <Icon size={20} className={color.replace('bg-', 'text-')} />
        </div>
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      </div>
      <p className="text-3xl font-bold text-slate-800">{value}</p>
      {trend && (
        <p className="flex items-center gap-1 mt-2 text-xs font-medium text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-full">
          <span className="text-emerald-500">↑</span> {trend} vs último mês
        </p>
      )}
    </div>
  </div>
);

// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Data State
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [knowledgeRules, setKnowledgeRules] = useLocalStorage<KnowledgeRule[]>('crm_rules_v3', []);
  const [aiConfig, setAiConfig] = useLocalStorage<AIConfig>('crm_ai_config', {
    model: 'gemini-2.5-flash',
    persona: DEFAULT_AI_PERSONA,
    knowledgeRules: [],
    temperature: 0.7,
    aiActive: false
  });
  const [initialMessage, setInitialMessage] = useLocalStorage<string>('crm_initial_msg', 'Olá, tudo bem?');
  
  // WhatsApp State
  const [waSession, setWaSession] = useState<WhatsAppSession>({ status: 'disconnected' });
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // API Integration State
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [imports, setImports] = useState<ImportBatch[]>([]);

  // Metadata Filters
  const [uniqueMotivos, setUniqueMotivos] = useState<string[]>([]);
  const [uniqueMunicipios, setUniqueMunicipios] = useState<string[]>([]);

  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  
  // Filters State
  const [campaignFilter, setCampaignFilter] = useState<CampaignStatus | 'all'>('all');
  const [campaignReasonFilter, setCampaignReasonFilter] = useState<string>('all');
  const [campaignCityFilter, setCampaignCityFilter] = useState<string>('all');
  const [campaignAccountantFilter, setCampaignAccountantFilter] = useState<'all' | 'with' | 'without'>('all');
  
  // Company Base Filters
  const [baseSearch, setBaseSearch] = useState('');
  const [baseCityFilter, setBaseCityFilter] = useState('all');
  const [baseReasonFilter, setBaseReasonFilter] = useState('all');
  const [baseAccountantFilter, setBaseAccountantFilter] = useState('all');
  
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);

  // --- Initial Data Load ---
  useEffect(() => {
    fetchCompanies();
    fetchMetadata();
    fetchImports();
    syncRulesWithServer(); // Initial sync
  }, []);

  // --- Optimized Polling (WhatsApp) ---
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/whatsapp/status');
        const data = await res.json();
        
        setWaSession(prev => {
            if (prev.status !== data.status || prev.qrCode !== data.qr) {
                return { status: data.status, qrCode: data.qr };
            }
            return prev;
        });

        // Only fetch chat list if connected and on Chat tab
        if (data.status === 'connected' && activeTab === 'chat') {
            const chatRes = await fetch('/api/whatsapp/chats');
            const chatData = await chatRes.json();
            // Basic compare to avoid re-renders if same
            setChats(prev => {
                if (prev.length !== chatData.length) return chatData;
                // If the first chat changed time, update
                if (prev[0]?.timestamp !== chatData[0]?.timestamp) return chatData;
                return prev;
            });
        }
      } catch (e) {
        console.error("Polling Error", e);
      }
    }, 4000); 
    return () => clearInterval(interval);
  }, [activeTab]);

  // --- Optimized Polling (Messages) ---
  useEffect(() => {
    if (!activeChat || activeTab !== 'chat') return;

    const fetchMessages = async () => {
        try {
            const res = await fetch(`/api/whatsapp/messages/${activeChat}`);
            const data = await res.json();
            setMessages(prev => {
                // If different length or last message ID differs
                if (prev.length !== data.length || prev[prev.length-1]?.id !== data[data.length-1]?.id) {
                    return data;
                }
                return prev;
            });
        } catch (e) {
            console.error("Message Error", e);
        }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 2500); // Faster polling for live chat
    return () => clearInterval(interval);
  }, [activeChat, activeTab]);

  // Scroll to bottom only when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeChat]);

  // --- Actions ---

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/get-all-results');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch (error) {
      console.error("Falha ao buscar empresas:", error);
    }
  };

  const fetchMetadata = async () => {
      try {
          const res = await fetch('/api/unique-filters');
          if (res.ok) {
              const data = await res.json();
              setUniqueMotivos(data.motivos || []);
              setUniqueMunicipios(data.municipios || []);
          }
      } catch (e) { console.error(e); }
  };

  const fetchImports = async () => {
      try {
          const res = await fetch('/get-imports');
          if (res.ok) setImports(await res.json());
      } catch (e) { console.error(e); }
  };

  const syncRulesWithServer = async () => {
      try {
        await fetch('/api/config/ai-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rules: knowledgeRules })
        });
      } catch (e) {
          console.error("Erro ao sincronizar regras", e);
      }
  };

  // SSE Listener for Progress
  useEffect(() => {
    if (!currentProcessId || !isProcessing) return;

    const eventSource = new EventSource(`/progress/${currentProcessId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'not_found') return;

        const percent = data.total > 0 ? Math.round((data.processed / data.total) * 100) : 0;
        setUploadProgress(percent);
        setProcessingStatus(`Processando... ${data.processed} de ${data.total}`);

        if (data.status === 'completed' || data.status === 'error') {
          setIsProcessing(false);
          eventSource.close();
          fetchCompanies();
          fetchImports();
          fetchMetadata(); // Update filters with new data
          alert(data.status === 'completed' ? "Processamento concluído!" : "Processamento finalizou com erros.");
        }
      } catch (e) { console.error(e); }
    };

    return () => {
      eventSource.close();
    };
  }, [currentProcessId, isProcessing]);

  // --- Handlers ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsProcessing(true);
      setUploadProgress(0);
      setProcessingStatus('Iniciando upload...');

      const res = await fetch('/start-processing', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error(await res.text());

      const data = await res.json();
      setCurrentProcessId(data.processId);
      
    } catch (error) {
      console.error("Erro no upload:", error);
      setIsProcessing(false);
      alert("Erro ao enviar arquivo.");
    }
  };

  const handleReprocess = async (processId: string) => {
      if (!confirm("Deseja reprocessar este lote? O sistema irá consultar a SEFAZ novamente para todas as IEs.")) return;
      try {
          setIsProcessing(true);
          setUploadProgress(0);
          setProcessingStatus('Reiniciando processamento...');
          const res = await fetch(`/reprocess/${processId}`, { method: 'POST' });
          if (!res.ok) throw new Error('Falha');
          setCurrentProcessId(processId); // Start listening to progress
      } catch (e) {
          setIsProcessing(false);
          alert('Erro ao iniciar reprocessamento');
      }
  };

  const toggleAiActive = () => {
    setAiConfig(prev => ({ ...prev, aiActive: !prev.aiActive }));
  };

  const toggleChatAi = async (chatId: string, currentStatus: boolean) => {
      try {
          await fetch('/api/whatsapp/toggle-ai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chatId, active: !currentStatus })
          });
          setChats(prev => prev.map(c => c.id === chatId ? { ...c, isAiDisabled: currentStatus } : c));
      } catch (e) {
          console.error("Erro ao alternar IA", e);
      }
  };

  const sendMessage = async () => {
      if (!messageInput.trim() || !activeChat) return;
      try {
          // Optimistic UI update
          setMessages(prev => [...prev, {
              id: 'temp-' + Date.now(),
              fromMe: true,
              body: messageInput,
              timestamp: Date.now() / 1000
          }]);
          
          await fetch('/api/whatsapp/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chatId: activeChat, message: messageInput })
          });
          setMessageInput('');
      } catch (e) {
          console.error("Erro ao enviar", e);
      }
  };

  // Rule Management Handlers
  const addInstruction = (ruleId: string, type: 'simple' | 'flow') => {
      setKnowledgeRules(prev => prev.map(r => {
          if (r.id === ruleId) {
              const newInst: Instruction = {
                  id: Date.now().toString(),
                  title: 'Nova Instrução',
                  type,
                  content: ''
              };
              return { ...r, instructions: [...(r.instructions || []), newInst]};
          }
          return r;
      }));
  };

  const updateInstruction = (ruleId: string, instId: string, field: keyof Instruction, val: string) => {
      setKnowledgeRules(prev => prev.map(r => {
          if (r.id === ruleId) {
              return {
                  ...r,
                  instructions: r.instructions.map(i => i.id === instId ? { ...i, [field]: val } : i)
              };
          }
          return r;
      }));
  };

  const removeInstruction = (ruleId: string, instId: string) => {
      setKnowledgeRules(prev => prev.map(r => {
          if (r.id === ruleId) {
              return { ...r, instructions: r.instructions.filter(i => i.id !== instId) };
          }
          return r;
      }));
  };

  // --- Views ---

  const DashboardView = () => {
      const stats = useMemo(() => ({
          total: companies.length,
          success: companies.filter(c => c.status === 'Sucesso').length,
          pending: companies.filter(c => !c.campaignStatus || c.campaignStatus === CampaignStatus.PENDING).length,
          contacted: companies.filter(c => c.campaignStatus && c.campaignStatus !== CampaignStatus.PENDING).length,
      }), [companies]);

      return (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Dashboard Geral</h1>
            <p className="text-slate-500">Visão geral da sua operação.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total de Empresas" value={stats.total} icon={Briefcase} color="text-blue-600 bg-blue-600" trend="+12%" />
            <StatCard title="Empresas Contatadas" value={stats.contacted} icon={Megaphone} color="text-violet-600 bg-violet-600" trend="+5%" />
            <StatCard title="Leads (Respostas)" value={companies.filter(c => c.campaignStatus === CampaignStatus.REPLIED).length} icon={MessageCircle} color="text-emerald-600 bg-emerald-600" trend="+8%" />
            <StatCard title="Taxa de Inaptidão" value={stats.total > 0 ? "100%" : "0%"} icon={AlertTriangle} color="text-rose-600 bg-rose-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card-premium p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Funil de Campanhas</h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Pendentes', value: stats.pending },
                    { name: 'Enviadas', value: companies.filter(c => c.campaignStatus === CampaignStatus.SENT).length },
                    { name: 'Entregues', value: companies.filter(c => c.campaignStatus === CampaignStatus.DELIVERED).length },
                    { name: 'Respondidas', value: companies.filter(c => c.campaignStatus === CampaignStatus.REPLIED).length },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} cursor={{ fill: '#f8fafc' }} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-premium p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-6">Status da IA</h3>
              <div className="flex flex-col items-center justify-center h-64 text-center">
                 <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${aiConfig.aiActive ? 'bg-emerald-100 text-emerald-600 shadow-[0_0_30px_rgba(16,185,129,0.3)]' : 'bg-slate-100 text-slate-400'}`}>
                   <Bot size={48} />
                 </div>
                 <h4 className="text-xl font-bold text-slate-800 mb-1">{aiConfig.aiActive ? 'IA Ativa' : 'IA Pausada'}</h4>
                 <p className="text-sm text-slate-500 mb-6">{aiConfig.aiActive ? 'O bot está respondendo os clientes.' : 'O bot não enviará mensagens.'}</p>
                 <button onClick={toggleAiActive} className={`btn-base w-full ${aiConfig.aiActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/30'}`}>
                   {aiConfig.aiActive ? 'Desativar IA' : 'Ativar IA Agora'}
                 </button>
              </div>
            </div>
          </div>
        </div>
      );
  };

  const ImportView = () => (
    <div className="max-w-6xl mx-auto animate-slide-up pb-10">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Central de Importação</h2>
        <p className="text-slate-500">Arraste seu PDF ou gerencie importações anteriores.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Area */}
          <div className="card-premium p-8 text-center flex flex-col justify-center">
            <div className="border-3 border-dashed border-slate-200 rounded-3xl p-10 hover:border-brand-500 hover:bg-brand-50/30 transition-all duration-300 relative group cursor-pointer">
                <input type="file" accept=".pdf" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                <div className="w-20 h-20 bg-brand-100 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Upload size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800">Nova Importação</h3>
                <p className="text-slate-400">PDF da SEFAZ</p>
                <div className="mt-6 inline-flex btn-primary pointer-events-none">Selecionar Arquivo</div>
            </div>
            
            {isProcessing && (
                <div className="mt-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between text-xs font-bold text-brand-600 mb-2">
                        <span>{processingStatus}</span>
                        <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 transition-all duration-300 relative overflow-hidden" style={{ width: `${uploadProgress}%` }}>
                             <div className="absolute inset-0 bg-white/30 w-full h-full animate-[shimmer_1s_infinite_-45deg]"></div>
                        </div>
                    </div>
                </div>
            )}
          </div>

          {/* History List */}
          <div className="card-premium p-6 overflow-hidden flex flex-col h-[500px]">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      <FileText size={18} className="text-brand-600" /> Histórico de Lotes
                  </h3>
                  <button onClick={fetchImports} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><RefreshCw size={14}/></button>
              </div>
              
              <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3 pr-2">
                  {imports.length === 0 && <div className="text-center text-slate-400 mt-10">Nenhum histórico encontrado.</div>}
                  {imports.map(batch => (
                      <div key={batch.id} className="p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors flex justify-between items-center group">
                          <div>
                              <div className="font-medium text-slate-800 flex items-center gap-2">
                                  {batch.filename}
                              </div>
                              <div className="text-xs text-slate-400 mt-1 flex gap-2">
                                  <span>{new Date(batch.date).toLocaleDateString()} {new Date(batch.date).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</span>
                                  <span>•</span>
                                  <span>{batch.total} registros</span>
                              </div>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${batch.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : batch.status === 'processing' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {batch.status === 'completed' ? 'Concluído' : batch.status === 'processing' ? 'Processando' : 'Erro'}
                              </span>
                              <button 
                                onClick={() => handleReprocess(batch.id)} 
                                className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" 
                                title="Reprocessar na SEFAZ"
                              >
                                  <Play size={16} />
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      </div>
    </div>
  );

  const CampaignView = () => {
    // Advanced Filtering Logic
    const filteredCompanies = companies.filter(c => {
      const statusMatch = campaignFilter === 'all' || (c.campaignStatus || CampaignStatus.PENDING) === campaignFilter;
      const reasonMatch = campaignReasonFilter === 'all' || c.motivoSituacao === campaignReasonFilter;
      const cityMatch = campaignCityFilter === 'all' || c.municipio === campaignCityFilter;
      const accMatch = campaignAccountantFilter === 'all' || 
                       (campaignAccountantFilter === 'with' ? !!c.nomeContador : !c.nomeContador);
      return statusMatch && reasonMatch && cityMatch && accMatch;
    });

    const toggleSelectAll = () => {
        if (selectedCompanies.length === filteredCompanies.length) setSelectedCompanies([]);
        else setSelectedCompanies(filteredCompanies.map(c => c.id));
    };

    const toggleSelectCompany = (id: string) => {
        setSelectedCompanies(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
    };

    return (
      <div className="h-full flex flex-col gap-6 animate-fade-in">
        <div className="flex justify-between items-start">
          <div><h2 className="text-2xl font-bold text-slate-800">Campanhas</h2><p className="text-slate-500">Filtre e dispare mensagens.</p></div>
          <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
             <span className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${aiConfig.aiActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><Bot size={16} />{aiConfig.aiActive ? 'IA Ativa' : 'IA Pausada'}</span>
             <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={aiConfig.aiActive} onChange={toggleAiActive} className="sr-only peer" /><div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div></label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full min-h-0">
          <div className="lg:col-span-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
            <div className="card-premium p-5 space-y-4">
                <h3 className="font-bold text-slate-800 flex gap-2"><Filter size={18}/> Filtros Avançados</h3>
                
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Status Campanha</label>
                    <select className="input-premium text-sm" value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value as any)}>
                        <option value="all">Todos</option><option value={CampaignStatus.PENDING}>Pendentes</option><option value={CampaignStatus.SENT}>Enviados</option><option value={CampaignStatus.REPLIED}>Respondidos</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Cidade</label>
                    <select className="input-premium text-sm" value={campaignCityFilter} onChange={(e) => setCampaignCityFilter(e.target.value)}>
                        <option value="all">Todas as Cidades</option>
                        {uniqueMunicipios.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Contador</label>
                    <select className="input-premium text-sm" value={campaignAccountantFilter} onChange={(e) => setCampaignAccountantFilter(e.target.value as any)}>
                        <option value="all">Todos</option><option value="with">Com Contador</option><option value="without">Sem Contador</option>
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 uppercase">Motivo Inaptidão</label>
                    <select className="input-premium text-sm" value={campaignReasonFilter} onChange={(e) => setCampaignReasonFilter(e.target.value)}>
                        <option value="all">Todos os Motivos</option>
                        {uniqueMotivos.map(m => <option key={m} value={m} title={m}>{m.length > 30 ? m.substring(0,30)+'...' : m}</option>)}
                    </select>
                </div>
            </div>

            <div className="card-premium p-5 flex-1 flex flex-col bg-brand-50 border-brand-100">
                <h3 className="font-bold text-brand-800 mb-2 flex items-center gap-2"><Send size={18}/> Disparo</h3>
                <div className="flex-1">
                    <label className="text-xs font-semibold text-brand-600 uppercase mb-1 block">Mensagem Inicial</label>
                    <textarea 
                        className="w-full h-32 p-3 rounded-xl border border-brand-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none bg-white"
                        value={initialMessage}
                        onChange={(e) => setInitialMessage(e.target.value)}
                        placeholder="Olá, vi que sua empresa..."
                    />
                </div>
                <div className="mt-4 pt-4 border-t border-brand-200">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-bold text-brand-700">Selecionados:</span>
                        <span className="bg-white px-2 py-1 rounded-lg text-brand-600 font-bold border border-brand-200">{selectedCompanies.length}</span>
                    </div>
                    <button className="btn-primary w-full text-sm" disabled={selectedCompanies.length === 0} onClick={() => alert('Campanha iniciada!')}>
                        Iniciar Disparos
                    </button>
                </div>
            </div>
          </div>

          <div className="lg:col-span-3 card-premium flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer" 
                    checked={filteredCompanies.length > 0 && selectedCompanies.length === filteredCompanies.length} onChange={toggleSelectAll} />
                <span className="text-sm font-semibold text-slate-600">Selecionar Todos ({filteredCompanies.length})</span>
              </div>
            </div>
            <div className="overflow-auto flex-1 custom-scrollbar p-0">
              <table className="w-full text-left border-collapse">
                  <thead className="bg-white sticky top-0 z-10 shadow-sm">
                      <tr>
                          <th className="p-4 w-12"></th>
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase">Empresa</th>
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase">Motivo</th>
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase">Local</th>
                          <th className="p-4 text-xs font-bold text-slate-400 uppercase">Status</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredCompanies.map((company) => (
                      <tr key={company.id} className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedCompanies.includes(company.id) ? 'bg-brand-50/50' : ''}`} onClick={() => toggleSelectCompany(company.id)}>
                        <td className="p-4 w-12">
                          <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer" checked={selectedCompanies.includes(company.id)} readOnly />
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-800 text-sm">{company.razaoSocial}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{company.nomeContador ? `Contador: ${company.nomeContador}` : 'Sem contador vinculado'}</div>
                        </td>
                        <td className="p-4"><div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded max-w-[200px] truncate" title={company.motivoSituacao}>{company.motivoSituacao}</div></td>
                        <td className="p-4"><div className="text-sm text-slate-600">{company.municipio}</div></td>
                        <td className="p-4">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                            ${company.campaignStatus === CampaignStatus.REPLIED ? 'bg-emerald-100 text-emerald-700' :
                              company.campaignStatus === CampaignStatus.SENT ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                            {company.campaignStatus || 'PENDENTE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const KnowledgeBaseView = () => {
    const selectedRule = knowledgeRules.find(r => r.id === selectedRuleId);

    const createRuleFromMotivo = (motivo: string) => {
        if (knowledgeRules.some(r => r.motivoSituacao === motivo)) {
            alert('Já existe uma regra para este motivo.');
            return;
        }
        const newRule: KnowledgeRule = {
            id: Date.now().toString(),
            motivoSituacao: motivo,
            instructions: [],
            isActive: true
        };
        setKnowledgeRules(prev => [...prev, newRule]);
        setSelectedRuleId(newRule.id);
    };

    return (
      <div className="h-full flex flex-col gap-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Base de Conhecimento</h2>
            <p className="text-slate-500">Gerencie as instruções da IA por contexto.</p>
          </div>
          <div className="flex gap-3">
              <button className="btn-primary" onClick={syncRulesWithServer}>
                  <Save size={18} /> Salvar Alterações
              </button>
              <div className="relative group">
                  <button className="btn-secondary">
                      <Plus size={18} /> Novo Contexto
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl hidden group-hover:block z-50 p-2">
                      <div className="text-xs font-bold text-slate-400 px-2 py-2 border-b border-slate-100">MOTIVOS ENCONTRADOS NO BANCO</div>
                      <div className="max-h-64 overflow-y-auto custom-scrollbar pt-2">
                          {uniqueMotivos.map(m => (
                              <button key={m} onClick={() => createRuleFromMotivo(m)} className="w-full text-left px-3 py-2 text-xs hover:bg-brand-50 hover:text-brand-700 rounded-lg truncate transition-colors mb-1">
                                  {m}
                              </button>
                          ))}
                          {uniqueMotivos.length === 0 && <div className="text-xs text-center text-slate-400 py-4">Nenhum motivo encontrado.</div>}
                      </div>
                  </div>
              </div>
          </div>
        </div>

        <div className="flex gap-6 h-full min-h-0">
          <div className="w-80 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
             <div className="p-4 bg-slate-50 border-b border-slate-100"><span className="text-xs font-bold text-slate-400">REGRAS ATIVAS</span></div>
             <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
               {knowledgeRules.map(rule => (
                 <button key={rule.id} onClick={() => setSelectedRuleId(rule.id)}
                   className={`w-full text-left p-3 rounded-xl transition-all duration-200 border ${selectedRuleId === rule.id ? 'bg-brand-50 border-brand-200 text-brand-700 shadow-sm' : 'hover:bg-slate-50 text-slate-600 border-transparent'}`}>
                   <div className="font-medium text-sm truncate" title={rule.motivoSituacao}>{rule.motivoSituacao}</div>
                   <div className="text-xs text-slate-400 mt-1 flex items-center gap-1"><FileText size={10}/> {rule.instructions?.length || 0} instruções</div>
                 </button>
               ))}
             </div>
          </div>

          <div className="flex-1 card-premium p-6 overflow-hidden flex flex-col">
             {selectedRule ? (
               <div className="flex flex-col h-full">
                   <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4 shrink-0">
                     <h3 className="font-bold text-lg text-slate-800 truncate pr-4" title={selectedRule.motivoSituacao}>{selectedRule.motivoSituacao}</h3>
                     <button onClick={() => { 
                         if(confirm('Excluir esta regra?')) {
                             setKnowledgeRules(prev => prev.filter(r => r.id !== selectedRule.id)); 
                             setSelectedRuleId(null); 
                         }
                     }} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"><Trash2 size={18} /></button>
                   </div>

                   <div className="flex gap-2 mb-4 shrink-0">
                       <button onClick={() => addInstruction(selectedRule.id, 'simple')} className="btn-secondary text-xs py-2"><Plus size={14}/> Resposta Simples</button>
                       <button onClick={() => addInstruction(selectedRule.id, 'flow')} className="btn-secondary text-xs py-2"><Plus size={14}/> Resposta com Flow</button>
                   </div>

                   <div className="overflow-y-auto custom-scrollbar flex-1 space-y-4 pr-2">
                       {(!selectedRule.instructions || selectedRule.instructions.length === 0) && (
                           <div className="text-center p-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 mt-4">
                               Nenhuma instrução criada. Clique nos botões acima para adicionar.
                           </div>
                       )}

                       {selectedRule.instructions?.map(inst => (
                           <div key={inst.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all">
                               <div className="flex justify-between mb-2 items-center">
                                   <input type="text" value={inst.title} onChange={(e) => updateInstruction(selectedRule.id, inst.id, 'title', e.target.value)} 
                                       className="bg-transparent font-bold text-slate-700 text-sm focus:outline-none border-b border-transparent focus:border-brand-500 w-1/2" placeholder="Título da Instrução (ex: Preço)" />
                                   <div className="flex items-center gap-2">
                                       <span className="text-[10px] uppercase font-bold text-slate-400 bg-white px-2 py-1 rounded border border-slate-200">{inst.type}</span>
                                       <button onClick={() => removeInstruction(selectedRule.id, inst.id)} className="text-slate-400 hover:text-rose-500 p-1"><X size={14}/></button>
                                   </div>
                               </div>
                               <textarea value={inst.content} onChange={(e) => updateInstruction(selectedRule.id, inst.id, 'content', e.target.value)}
                                   className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-brand-500 bg-white min-h-[100px] resize-y" placeholder="Instruções para a IA... ex: Quando o cliente perguntar preço, fale X..." />
                           </div>
                       ))}
                   </div>
               </div>
             ) : (
               <div className="flex flex-col items-center justify-center h-full text-slate-400">
                   <BookOpen size={48} className="mb-4 opacity-20"/>
                   <p>Selecione uma regra à esquerda ou crie uma nova.</p>
               </div>
             )}
          </div>
        </div>
      </div>
    );
  };

  const ChatView = () => {
      const activeChatData = chats.find(c => c.id === activeChat);
      return (
          <div className="flex h-full bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-200 animate-fade-in">
              <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col">
                  <div className="p-4 border-b border-slate-200 bg-slate-100">
                      <div className="relative">
                          <input type="text" placeholder="Buscar conversa..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
                          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                      </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                      {chats.map(chat => (
                          <div key={chat.id} onClick={() => setActiveChat(chat.id)} className={`p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors flex items-center gap-3 ${activeChat === chat.id ? 'bg-emerald-50' : ''}`}>
                              <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center shrink-0"><User className="text-white" size={20} /></div>
                              <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-baseline"><h4 className="text-sm font-semibold text-slate-800 truncate">{chat.name}</h4><span className="text-xs text-slate-400">{new Date(chat.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div>
                                  <p className="text-xs text-slate-500 truncate">{chat.lastMessage}</p>
                              </div>
                              {chat.isAiDisabled && <div title="IA Desativada"><Bot size={14} className="text-rose-400" /></div>}
                          </div>
                      ))}
                  </div>
              </div>
              <div className="flex-1 flex flex-col bg-[#efeae2]">
                  {activeChat ? (
                      <>
                          <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                              <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center"><User className="text-white" size={20} /></div>
                                  <div><h3 className="font-semibold text-slate-800">{activeChatData?.name}</h3><p className="text-xs text-slate-500">Online</p></div>
                              </div>
                              <div className="flex items-center gap-4">
                                  <div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-600">IA:</span><button onClick={() => toggleChatAi(activeChat, !!activeChatData?.isAiDisabled)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${!activeChatData?.isAiDisabled ? 'bg-emerald-500' : 'bg-slate-300'}`}><span className={`inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out ${!activeChatData?.isAiDisabled ? 'translate-x-5' : 'translate-x-1'}`} /></button></div>
                                  <MoreVertical className="text-slate-500 cursor-pointer" />
                              </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-opacity-50" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")' }}>
                              {messages.map(msg => (
                                  <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                                      <div className={`max-w-[70%] p-3 rounded-lg shadow-sm text-sm relative ${msg.fromMe ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'}`}>
                                          {msg.type === 'ptt' || msg.type === 'audio' ? (
                                              <div className="flex items-center gap-2 text-slate-500">
                                                  <Mic size={16} /> <span>Áudio</span>
                                              </div>
                                          ) : (
                                              <p>{msg.body}</p>
                                          )}
                                          <span className="text-[10px] text-slate-400 block text-right mt-1">{new Date(msg.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                      </div>
                                  </div>
                              ))}
                              <div ref={messagesEndRef} />
                          </div>
                          <div className="bg-slate-100 p-3 flex items-center gap-3">
                              <Smile className="text-slate-500 cursor-pointer" /><Paperclip className="text-slate-500 cursor-pointer" />
                              <input type="text" className="flex-1 p-2 rounded-lg border border-slate-300 focus:outline-none focus:border-emerald-500" placeholder="Digite uma mensagem..." value={messageInput} onChange={(e) => setMessageInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} />
                              <button onClick={sendMessage} className="p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors"><Send size={20} /></button>
                          </div>
                      </>
                  ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                          <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-4"><MessageCircle size={40} className="text-slate-400" /></div>
                          <h3 className="text-lg font-semibold text-slate-600">WhatsApp Conectado</h3><p>Selecione uma conversa para começar.</p>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const WhatsAppView = () => {
    const isConnected = waSession.status === 'connected';
    return (
      <div className="h-full flex flex-col animate-fade-in justify-center items-center">
          <div className="card-premium p-10 max-w-lg w-full text-center">
            <div className={`mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 ${isConnected ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
              <MessageCircle size={32} className={isConnected ? '' : 'animate-pulse'} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">{isConnected ? 'WhatsApp Conectado' : 'Conectar WhatsApp'}</h3>
            <p className="text-slate-500 mb-8">{isConnected ? 'Seu bot está online e pronto.' : 'Escaneie o QR Code.'}</p>
            {!isConnected && waSession.status === 'qr_ready' && waSession.qrCode ? (
              <div className="bg-white p-4 rounded-xl shadow-lg inline-block border border-slate-200"><img src={waSession.qrCode} alt="QR Code" className="w-64 h-64 object-contain" /></div>
            ) : !isConnected ? (
              <div className="w-64 h-64 mx-auto bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-sm">Carregando QR...</div>
            ) : (
              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-100 flex items-center gap-3 justify-center"><CheckCircle2 size={24} /><span className="font-semibold">Sessão Ativa</span></div>
            )}
            <div className="mt-8 text-xs text-slate-400">Status: <span className="font-mono font-bold">{waSession.status}</span></div>
          </div>
      </div>
    );
  };

  const EmpresasView = () => {
    // Company Base Filtering
    const baseFiltered = companies.filter(c => {
        const matchesSearch = baseSearch === '' || 
            (c.razaoSocial && c.razaoSocial.toLowerCase().includes(baseSearch.toLowerCase())) ||
            (c.cnpj && c.cnpj.includes(baseSearch)) ||
            (c.inscricaoEstadual && c.inscricaoEstadual.includes(baseSearch)) ||
            (c.telefone && c.telefone.includes(baseSearch));
        
        const matchesCity = baseCityFilter === 'all' || c.municipio === baseCityFilter;
        const matchesReason = baseReasonFilter === 'all' || c.motivoSituacao === baseReasonFilter;
        const matchesAccountant = baseAccountantFilter === 'all' || 
            (baseAccountantFilter === 'with' ? !!c.nomeContador : !c.nomeContador);
            
        return matchesSearch && matchesCity && matchesReason && matchesAccountant;
    });

    return (
        <div className="space-y-6 h-full flex flex-col animate-fade-in">
          <div className="flex justify-between items-center">
            <div><h2 className="text-2xl font-bold text-slate-800">Base de Empresas</h2><p className="text-slate-500">Todos os leads importados ({baseFiltered.length}).</p></div>
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={fetchCompanies}><RefreshCw size={18} /> Atualizar</button>
              <button className="btn-primary"><FileSpreadsheet size={18} /> Exportar</button>
            </div>
          </div>
          
          <div className="card-premium flex-1 overflow-hidden flex flex-col">
            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Nome, CNPJ ou Telefone..." 
                        className="input-premium pl-10 py-2 text-sm"
                        value={baseSearch}
                        onChange={(e) => setBaseSearch(e.target.value)}
                    />
                </div>
                <select className="input-premium py-2 text-sm" value={baseCityFilter} onChange={(e) => setBaseCityFilter(e.target.value)}>
                    <option value="all">Todas as Cidades</option>
                    {uniqueMunicipios.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select className="input-premium py-2 text-sm" value={baseReasonFilter} onChange={(e) => setBaseReasonFilter(e.target.value)}>
                    <option value="all">Todos os Motivos</option>
                    {uniqueMotivos.map(m => <option key={m} value={m}>{m.length > 30 ? m.substring(0,30)+'...' : m}</option>)}
                </select>
                <select className="input-premium py-2 text-sm" value={baseAccountantFilter} onChange={(e) => setBaseAccountantFilter(e.target.value)}>
                    <option value="all">Status Contador</option>
                    <option value="with">Com Contador</option>
                    <option value="without">Sem Contador</option>
                </select>
            </div>
    
            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="p-4 text-sm font-bold text-slate-500 uppercase">Empresa</th>
                        <th className="p-4 text-sm font-bold text-slate-500 uppercase">Situação</th>
                        <th className="p-4 text-sm font-bold text-slate-500 uppercase">Motivo</th>
                        <th className="p-4 text-sm font-bold text-slate-500 uppercase">Local</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {baseFiltered.length === 0 && (
                      <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhuma empresa encontrada com estes filtros.</td></tr>
                  )}
                  {baseFiltered.map((company) => (
                    <tr key={company.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                          <div className="font-semibold text-slate-800">{company.razaoSocial}</div>
                          <div className="text-xs text-slate-400">{company.cnpj} {company.telefone ? `• ${company.telefone}` : ''}</div>
                          {company.nomeContador && <div className="text-xs text-brand-600 font-medium mt-1">Contador: {company.nomeContador}</div>}
                      </td>
                      <td className="p-4"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${company.situacaoCadastral === 'ATIVA' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{company.situacaoCadastral || 'N/A'}</span></td>
                      <td className="p-4 text-sm text-slate-600 max-w-xs truncate" title={company.motivoSituacao}>{company.motivoSituacao}</td>
                      <td className="p-4 text-sm text-slate-600">{company.municipio}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div className={`bg-slate-900 text-white transition-all duration-300 flex flex-col shadow-2xl relative z-20 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(37,99,235,0.5)]"><span className="font-bold text-lg">C</span></div>
          {sidebarOpen && <div className="animate-fade-in"><h1 className="font-bold text-lg tracking-tight">CRM VIRGULA</h1></div>}
        </div>
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto custom-scrollbar">
          <div>{sidebarOpen && <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-4">Visão Geral</p>}<SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={!sidebarOpen} /></div>
          <div>{sidebarOpen && <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-4">Aquisição</p>}<SidebarItem icon={Upload} label="Importar Dados" active={activeTab === 'import'} onClick={() => setActiveTab('import')} collapsed={!sidebarOpen} /><SidebarItem icon={Briefcase} label="Base de Empresas" active={activeTab === 'empresas'} onClick={() => setActiveTab('empresas')} collapsed={!sidebarOpen} /></div>
          <div>{sidebarOpen && <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-4">Vendas</p>}<SidebarItem icon={Megaphone} label="Gestão de Campanhas" active={activeTab === 'campanhas'} onClick={() => setActiveTab('campanhas')} collapsed={!sidebarOpen} /><SidebarItem icon={MessageSquare} label="Chat Ao Vivo" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} collapsed={!sidebarOpen} /><SidebarItem icon={MessageCircle} label="Conexão WhatsApp" active={activeTab === 'whatsapp'} onClick={() => setActiveTab('whatsapp')} collapsed={!sidebarOpen} /></div>
          <div>{sidebarOpen && <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-4">Inteligência</p>}<SidebarItem icon={BookOpen} label="Treinamento IA" active={activeTab === 'knowledge'} onClick={() => setActiveTab('knowledge')} collapsed={!sidebarOpen} /><SidebarItem icon={Settings} label="Configurações" active={activeTab === 'config'} onClick={() => setActiveTab('config')} collapsed={!sidebarOpen} /></div>
        </nav>
        <div className="p-4 border-t border-slate-800 bg-slate-900/50"><div className={`rounded-xl p-3 flex items-center gap-3 transition-colors ${aiConfig.aiActive ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-800'}`}><div className={`w-2 h-2 rounded-full shrink-0 ${aiConfig.aiActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />{sidebarOpen && <div className="overflow-hidden"><p className="text-xs font-bold text-slate-300">Status do Bot</p><p className="text-xs text-slate-500 truncate">{aiConfig.aiActive ? 'Respondendo...' : 'Desconectado.'}</p></div>}</div></div>
      </div>
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors"><Menu size={20} /></button>
          <div className="flex items-center gap-4"><div className="flex items-center gap-2 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-full text-xs font-bold border border-brand-100"><Briefcase size={14} /> CRM VIRGULA</div></div>
        </header>
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
          <div className="max-w-7xl mx-auto h-full">
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'import' && <ImportView />}
            {activeTab === 'empresas' && <EmpresasView />}
            {activeTab === 'campanhas' && <CampaignView />}
            {activeTab === 'chat' && <ChatView />}
            {activeTab === 'knowledge' && <KnowledgeBaseView />}
            {activeTab === 'whatsapp' && <WhatsAppView />}
            {activeTab === 'config' && <div className="flex flex-col items-center justify-center h-full text-slate-400 animate-fade-in"><Settings size={64} className="mb-4 opacity-20" /><h2 className="text-xl font-bold text-slate-600">Configurações</h2><p>Ajustes de sistema e API.</p></div>}
          </div>
        </main>
      </div>
    </div>
  );
}
