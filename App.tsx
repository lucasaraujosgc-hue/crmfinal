import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Upload, MessageCircle, Bot, Settings, Menu, FileSpreadsheet, Search,
  CheckCircle2, AlertCircle, Send, RefreshCw, BookOpen, Plus, Trash2,
  Briefcase, MessageSquare, User, Paperclip, Mic, X, Save,
  BarChart3, Trello, MoreHorizontal, PlayCircle, PauseCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { CompanyResult, Status, CampaignStatus, KnowledgeRule, AIConfig, WhatsAppSession, ImportBatch } from './types';
import { DEFAULT_KNOWLEDGE_RULES, DEFAULT_AI_PERSONA } from './constants';

// --- Hooks ---

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(error);
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
      console.warn(error);
    }
  };
  return [storedValue, setValue];
}

function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay !== null) {
      const id = setInterval(() => savedCallback.current(), delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

// --- Components ---

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Data States
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [stats, setStats] = useState({ total: 0, processed: 0, success: 0, errors: 0 });
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);

  // Import Process State
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const [processProgress, setProcessProgress] = useState({ total: 0, processed: 0, status: '' });

  // Filters State
  const [filters, setFilters] = useState({
    search: '',
    city: '',
    reason: '',
    hasAccountant: 'all', // all, yes, no
    status: 'all',
    hasPhone: 'all'
  });
  
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableReasons, setAvailableReasons] = useState<string[]>([]);

  // AI & Rules
  const [aiConfig, setAiConfig] = useLocalStorage<AIConfig>('crm_ai_config', {
    model: 'gemini-2.5-flash',
    persona: DEFAULT_AI_PERSONA,
    knowledgeRules: DEFAULT_KNOWLEDGE_RULES,
    temperature: 0.7,
    aiActive: true
  });
  const [editingRule, setEditingRule] = useState<KnowledgeRule | null>(null);

  // WhatsApp State
  const [waSession, setWaSession] = useState<WhatsAppSession>({ status: 'disconnected' });
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // Initial Load
  useEffect(() => {
    fetchCompanies();
    fetchImports();
    fetchFilters();
  }, []);

  useInterval(() => {
    fetchWhatsAppStatus();
    if (activeTab === 'whatsapp' && waSession.status === 'connected') {
      fetchChats();
      if (activeChat) fetchMessages(activeChat);
    }
  }, 3000);

  // Progress Polling for Import
  useInterval(() => {
    if (currentProcessId) {
      fetch(`/progress/${currentProcessId}`)
        .then(res => {
           const reader = res.body?.getReader();
           return new ReadableStream({
             start(controller) {
               function push() {
                 reader?.read().then(({ done, value }) => {
                   if (done) { controller.close(); return; }
                   const chunk = new TextDecoder("utf-8").decode(value);
                   const lines = chunk.split('\n\n');
                   lines.forEach(line => {
                     if (line.startsWith('data: ')) {
                       try {
                         const data = JSON.parse(line.replace('data: ', ''));
                         if (data.status === 'not_found') return;
                         setProcessProgress(data);
                         if (data.status === 'completed' || data.status === 'error') {
                           fetchCompanies(); // Refresh data
                           fetchImports();
                           setTimeout(() => setCurrentProcessId(null), 2000);
                         }
                       } catch (e) {}
                     }
                   });
                   push();
                 });
               }
               push();
             }
           });
        })
        .catch(console.error);
    }
  }, currentProcessId ? 1000 : null);

  useEffect(() => {
    fetch('/api/config/ai-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: aiConfig.knowledgeRules })
    }).catch(console.error);
  }, [aiConfig.knowledgeRules]);

  // --- API Calls ---

  const fetchFilters = async () => {
    try {
      const res = await fetch('/api/unique-filters');
      if (res.ok) {
        const data = await res.json();
        setAvailableCities(data.municipios || []);
        setAvailableReasons(data.motivos || []);
      }
    } catch (e) { console.error(e); }
  };

  const fetchCompanies = async () => {
    setIsLoadingCompanies(true);
    try {
      const res = await fetch('/get-all-results');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
        const success = data.filter((c: any) => c.status === 'Sucesso' || c.status === Status.SUCCESS).length;
        const errors = data.filter((c: any) => c.status !== 'Sucesso' && c.status !== Status.SUCCESS).length;
        setStats({ total: data.length, processed: data.length, success, errors });
      }
    } catch (error) { console.error(error); } 
    finally { setIsLoadingCompanies(false); }
  };

  const fetchImports = async () => {
    try {
      const res = await fetch('/get-imports');
      if (res.ok) setImports(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchWhatsAppStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        setWaSession({ status: data.status, qrCode: data.qr });
      }
    } catch (e) { console.error(e); }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch('/api/whatsapp/chats');
      if (res.ok) setChats(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/whatsapp/messages/${chatId}`);
      if (res.ok) setChatMessages(await res.json());
    } catch (e) { console.error(e); }
  };

  const sendMessage = async () => {
    if (!activeChat || !newMessage.trim()) return;
    try {
      setChatMessages(prev => [...prev, { id: 'temp-'+Date.now(), fromMe: true, body: newMessage, timestamp: Date.now()/1000 }]);
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChat, message: newMessage })
      });
      if (res.ok) {
        setNewMessage('');
        fetchMessages(activeChat);
      }
    } catch (e) { console.error(e); }
  };

  const toggleAIChat = async (chatId: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/whatsapp/toggle-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, active: !currentStatus })
      });
      if (res.ok) fetchChats();
    } catch (e) { console.error(e); }
  };

  // --- Filtering Logic ---

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const searchMatch = !filters.search || 
        c.razaoSocial?.toLowerCase().includes(filters.search.toLowerCase()) ||
        c.inscricaoEstadual?.includes(filters.search) ||
        c.cnpj?.includes(filters.search);
        
      const cityMatch = !filters.city || c.municipio === filters.city;
      const reasonMatch = !filters.reason || (c.motivoSituacao && c.motivoSituacao.includes(filters.reason));
      const accountantMatch = filters.hasAccountant === 'all' ? true :
        filters.hasAccountant === 'yes' ? !!c.nomeContador : !c.nomeContador;
      const phoneMatch = filters.hasPhone === 'all' ? true :
        filters.hasPhone === 'yes' ? !!c.telefone : !c.telefone;

      return searchMatch && cityMatch && reasonMatch && accountantMatch && phoneMatch;
    });
  }, [companies, filters]);

  // --- Helpers ---

  const renderStatusBadge = (status: string) => {
    const isSuccess = status === 'Sucesso' || status === Status.SUCCESS;
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
        isSuccess ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
      }`}>
        {isSuccess ? 'Sucesso' : 'Erro'}
      </span>
    );
  };

  // --- Render ---

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans text-slate-900">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-brand-950 text-white transition-all duration-300 flex flex-col shadow-2xl z-20`}>
        <div className="p-4 flex items-center justify-between border-b border-brand-800/50">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shrink-0">
              <span className="font-bold text-white text-lg">V</span>
            </div>
            {isSidebarOpen && <span className="font-bold text-lg tracking-tight whitespace-nowrap">CRM VÍRGULA</span>}
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-brand-800 rounded-lg">
            <Menu size={18} className="text-brand-200" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'import', icon: Upload, label: 'Importar PDF' },
            { id: 'companies', icon: FileSpreadsheet, label: 'Base de Empresas' },
            { id: 'campaigns', icon: Trello, label: 'Gestão de Campanhas' },
            { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', badge: waSession.status === 'connected' ? 'On' : 'Off' },
            { id: 'knowledge', icon: BookOpen, label: 'Base de Conhecimento' },
            { id: 'settings', icon: Settings, label: 'Configurações' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                activeTab === item.id 
                  ? 'bg-brand-600 text-white shadow-lg' 
                  : 'text-brand-200 hover:bg-brand-900/50 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              {isSidebarOpen && (
                <>
                  <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${item.badge === 'On' ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 relative">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">
            {activeTab === 'dashboard' && 'Visão Geral'}
            {activeTab === 'import' && 'Importação de Dados'}
            {activeTab === 'companies' && 'Base de Empresas'}
            {activeTab === 'campaigns' && 'Funil de Vendas'}
            {activeTab === 'whatsapp' && 'Atendimento'}
            {activeTab === 'knowledge' && 'Base de Conhecimento'}
            {activeTab === 'settings' && 'Configurações do Sistema'}
          </h1>
        </header>

        <div className="p-8 max-w-[1600px] mx-auto pb-20">
          
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total na Base', value: stats.total, color: 'text-brand-600', bg: 'bg-brand-50' },
                  { label: 'Sucesso Scraper', value: stats.success, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Erros Leitura', value: stats.errors, color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Campanhas Ativas', value: companies.filter(c => c.campaignStatus !== 'pending').length, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map((stat, i) => (
                  <div key={i} className="card-premium p-6 hover:-translate-y-1 transition-transform">
                    <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                    <h3 className={`text-3xl font-bold ${stat.color}`}>{stat.value}</h3>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card-premium p-6">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-700">
                    <BarChart3 className="text-brand-500" size={20} />
                    Top Cidades
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={companies.slice(0, 8).map(c => ({ name: c.municipio, value: 1 }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card-premium p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700">
                    <Upload className="text-brand-500" size={20} />
                    Últimas Importações
                  </h3>
                  <div className="overflow-y-auto h-64 custom-scrollbar">
                    {imports.map((imp) => (
                      <div key={imp.id} className="flex items-center justify-between p-3 mb-2 rounded-xl bg-slate-50 border border-slate-100">
                        <div>
                            <p className="font-medium text-sm text-slate-800">{imp.filename}</p>
                            <p className="text-xs text-slate-500">{new Date(imp.date).toLocaleDateString()} • {imp.total} registros</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                          imp.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {imp.status === 'completed' ? 'Concluído' : 'Processando'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* IMPORTAÇÃO */}
          {activeTab === 'import' && (
            <div className="max-w-2xl mx-auto mt-10 space-y-8">
              {!currentProcessId ? (
                <div className="card-premium p-10 text-center border-2 border-dashed border-slate-300 hover:border-brand-400 transition-all group cursor-pointer relative bg-white">
                  <input 
                    type="file" 
                    accept=".pdf" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        const res = await fetch('/start-processing', { method: 'POST', body: formData });
                        if (res.ok) {
                          const { processId } = await res.json();
                          setCurrentProcessId(processId);
                        } else {
                          alert('Erro ao enviar arquivo.');
                        }
                      } catch (err) { console.error(err); alert('Erro de conexão.'); }
                    }}
                  />
                  <div className="w-24 h-24 bg-brand-50 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <Upload size={40} />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">Upload de PDF da SEFAZ</h3>
                  <p className="text-slate-500 text-lg">Arraste o arquivo ou clique para selecionar</p>
                </div>
              ) : (
                <div className="card-premium p-8 text-center animate-fade-in">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <RefreshCw size={32} className="animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Processando PDF...</h3>
                  <p className="text-slate-500 mb-6">O robô está consultando a SEFAZ. Por favor aguarde.</p>
                  
                  <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden mb-2">
                    <div 
                      className="bg-brand-500 h-4 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${processProgress.total > 0 ? (processProgress.processed / processProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-sm font-medium text-slate-600">
                    {processProgress.processed} de {processProgress.total} empresas consultadas
                  </p>
                </div>
              )}
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 text-sm">
                <AlertCircle className="shrink-0" size={20} />
                <p>O processo de raspagem pode levar alguns minutos dependendo do tamanho do PDF e da velocidade do site da SEFAZ.</p>
              </div>
            </div>
          )}

          {/* BASE DE EMPRESAS */}
          {activeTab === 'companies' && (
            <div className="space-y-6">
              <div className="card-premium p-4 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Buscar por Nome, IE ou CNPJ..." 
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                      value={filters.search}
                      onChange={e => setFilters({...filters, search: e.target.value})}
                    />
                  </div>
                  <button onClick={fetchCompanies} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><RefreshCw size={20} /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <select className="input-premium py-2 text-sm" value={filters.city} onChange={e => setFilters({...filters, city: e.target.value})}>
                    <option value="">Todas as Cidades</option>
                    {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <select className="input-premium py-2 text-sm" value={filters.reason} onChange={e => setFilters({...filters, reason: e.target.value})}>
                    <option value="">Todos os Motivos</option>
                    {availableReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>

                  <select className="input-premium py-2 text-sm" value={filters.hasAccountant} onChange={e => setFilters({...filters, hasAccountant: e.target.value})}>
                    <option value="all">Contador: Todos</option>
                    <option value="yes">Com Contador</option>
                    <option value="no">Sem Contador</option>
                  </select>
                </div>
              </div>

              <div className="card-premium overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Empresa</th>
                      <th className="px-6 py-4">Localização</th>
                      <th className="px-6 py-4">Contato</th>
                      <th className="px-6 py-4">Situação</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCompanies.slice(0, 100).map((company) => (
                      <tr key={company.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900">{company.razaoSocial || 'Nome Indisponível'}</p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{company.inscricaoEstadual}</span>
                            {company.nomeContador ? (
                                <span className="text-emerald-600 flex items-center gap-1"><User size={10}/> {company.nomeContador}</span>
                            ) : (
                              <span className="text-rose-400 flex items-center gap-1"><AlertCircle size={10}/> Sem contador</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{company.municipio}</td>
                        <td className="px-6 py-4">
                          {company.telefone ? (
                            <span className="flex items-center gap-1.5 text-slate-700">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                              {company.telefone}
                            </span>
                          ) : <span className="text-slate-400 italic">Não informado</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                            company.situacaoCadastral === 'ATIVA' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {company.situacaoCadastral}
                          </span>
                          {company.motivoSituacao && (
                            <p className="text-xs text-slate-500 mt-1 max-w-[200px] truncate" title={company.motivoSituacao}>
                              {company.motivoSituacao}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">{renderStatusBadge(company.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CAMPANHAS (KANBAN) */}
          {activeTab === 'campaigns' && (
            <div className="flex gap-4 overflow-x-auto h-[calc(100vh-140px)] pb-4">
               {[
                 { id: 'pending', title: 'Pendente', color: 'bg-slate-100 border-slate-200' },
                 { id: 'sent', title: 'Enviado', color: 'bg-blue-50 border-blue-200' },
                 { id: 'replied', title: 'Respondido', color: 'bg-amber-50 border-amber-200' },
                 { id: 'interested', title: 'Interessado', color: 'bg-emerald-50 border-emerald-200' },
                 { id: 'not_interested', title: 'Descartado', color: 'bg-rose-50 border-rose-200' }
               ].map(col => {
                 const items = companies.filter(c => c.campaignStatus === col.id || (col.id === 'pending' && !c.campaignStatus));
                 return (
                   <div key={col.id} className={`min-w-[300px] w-[300px] rounded-xl border flex flex-col ${col.color}`}>
                     <div className="p-4 font-bold text-slate-700 flex justify-between">
                       {col.title}
                       <span className="bg-white px-2 py-0.5 rounded text-sm shadow-sm">{items.length}</span>
                     </div>
                     <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                       {items.slice(0, 50).map(c => (
                         <div key={c.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-grab">
                           <p className="font-semibold text-sm text-slate-800 mb-1">{c.razaoSocial}</p>
                           <p className="text-xs text-slate-500 mb-2">{c.municipio}</p>
                           <div className="flex justify-between items-center mt-2">
                             {c.telefone ? (
                               <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded flex items-center gap-1">
                                 <MessageCircle size={10} /> WhatsApp
                               </span>
                             ) : (
                               <span className="text-xs text-slate-400">Sem telefone</span>
                             )}
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>
                 )
               })}
            </div>
          )}

          {/* WHATSAPP */}
          {activeTab === 'whatsapp' && (
            <div className="flex h-[calc(100vh-140px)] gap-6">
              <div className="w-1/3 card-premium flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
                   {waSession.status !== 'connected' && waSession.qrCode ? (
                      <div className="text-center p-4">
                         <img src={waSession.qrCode} alt="QR Code" className="w-48 h-48 mx-auto mb-4 border-4 border-white shadow-lg rounded-xl" />
                         <p className="text-sm font-medium text-slate-600 animate-pulse">Escaneie para conectar</p>
                      </div>
                   ) : (
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-700">Conversas</h3>
                        <div className={`text-xs font-medium px-2 py-1 rounded-full border ${waSession.status === 'connected' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600'}`}>
                           {waSession.status === 'connected' ? 'Conectado' : 'Desconectado'}
                        </div>
                      </div>
                   )}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                   {chats.map(chat => (
                      <div 
                        key={chat.id} 
                        onClick={() => { setActiveChat(chat.id); fetchMessages(chat.id); }}
                        className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${activeChat === chat.id ? 'bg-brand-50 border-l-4 border-l-brand-500' : ''}`}
                      >
                         <div className="flex justify-between items-start mb-1">
                            <h4 className="font-semibold text-slate-800 text-sm truncate max-w-[70%]">{chat.name}</h4>
                            <span className="text-[10px] text-slate-400">{new Date(chat.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                         </div>
                         <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                            {chat.isAiDisabled && <Bot size={12} className="text-rose-400" />}
                            {chat.lastMessage}
                         </p>
                      </div>
                   ))}
                </div>
              </div>

              <div className="flex-1 card-premium flex flex-col overflow-hidden relative">
                {activeChat ? (
                  <>
                     <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white z-10 shadow-sm">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                              <User size={20} />
                           </div>
                           <div>
                              <h3 className="font-bold text-slate-800">
                                {chats.find(c => c.id === activeChat)?.name || 'Desconhecido'}
                              </h3>
                              <p className="text-xs text-slate-500 flex items-center gap-1">
                                {chats.find(c => c.id === activeChat)?.isAiDisabled ? (
                                  <span className="text-rose-500 flex items-center gap-1"><PauseCircle size={10}/> IA Pausada</span>
                                ) : (
                                  <span className="text-emerald-500 flex items-center gap-1"><PlayCircle size={10}/> IA Ativa</span>
                                )}
                              </p>
                           </div>
                        </div>
                        <button 
                          onClick={() => toggleAIChat(activeChat, !chats.find(c => c.id === activeChat)?.isAiDisabled)}
                          className="btn-ghost text-xs border border-slate-200"
                        >
                          {chats.find(c => c.id === activeChat)?.isAiDisabled ? 'Ativar IA' : 'Pausar IA'}
                        </button>
                     </div>

                     <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#efeae2] custom-scrollbar">
                        {chatMessages.map(msg => (
                           <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[70%] rounded-xl p-3 shadow-sm text-sm relative ${
                                msg.fromMe ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none'
                              }`}>
                                 {msg.hasMedia && (
                                   <div className="mb-2 p-2 bg-black/5 rounded flex items-center gap-2 text-xs text-slate-600">
                                      {msg.type === 'ptt' || msg.type === 'audio' ? <Mic size={14}/> : <Paperclip size={14}/>}
                                      <span>Mídia ({msg.type})</span>
                                   </div>
                                 )}
                                 <p className="whitespace-pre-wrap">{msg.body}</p>
                              </div>
                           </div>
                        ))}
                     </div>

                     <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                        <input 
                          type="text" 
                          placeholder="Digite uma mensagem..." 
                          className="flex-1 bg-slate-100 border-0 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-brand-500/20 outline-none"
                          value={newMessage}
                          onChange={e => setNewMessage(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sendMessage()}
                        />
                        <button 
                          onClick={sendMessage}
                          className="p-2 bg-brand-600 text-white rounded-full hover:bg-brand-700 transition-colors shadow-lg shadow-brand-500/30"
                        >
                          <Send size={18} />
                        </button>
                     </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                     <MessageSquare size={48} className="mb-4 text-slate-300" />
                     <p>Selecione uma conversa</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* BASE DE CONHECIMENTO */}
          {activeTab === 'knowledge' && (
            <div>
               {editingRule ? (
                  <div className="max-w-4xl mx-auto card-premium p-8 animate-slide-up">
                      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-100">
                          <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                             <BookOpen className="text-brand-500" size={24} />
                             {editingRule.id.startsWith('new') ? 'Criar Nova Regra' : 'Editar Regra'}
                          </h3>
                          <div className="flex gap-3">
                             <button 
                                onClick={() => setEditingRule(null)}
                                className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium"
                             >
                                Cancelar
                             </button>
                             <button 
                                onClick={() => {
                                   const exists = aiConfig.knowledgeRules.find(r => r.id === editingRule.id);
                                   let newRules;
                                   if (exists) {
                                      newRules = aiConfig.knowledgeRules.map(r => r.id === editingRule.id ? editingRule : r);
                                   } else {
                                      newRules = [...aiConfig.knowledgeRules, { ...editingRule, id: Date.now().toString() }];
                                   }
                                   setAiConfig({...aiConfig, knowledgeRules: newRules});
                                   setEditingRule(null);
                                }}
                                className="btn-primary flex items-center gap-2"
                             >
                                <Save size={18} /> Salvar Regra
                             </button>
                          </div>
                       </div>

                       <div className="space-y-6">
                          <div>
                             <label className="block text-sm font-bold text-slate-700 mb-2">Gatilho (Motivo exato na SEFAZ)</label>
                             <input 
                                type="text" 
                                className="input-premium"
                                value={editingRule.motivoSituacao}
                                onChange={e => setEditingRule({...editingRule, motivoSituacao: e.target.value})}
                                placeholder="Ex: Art. 27 - Inc. XVIII - MEI"
                             />
                             <p className="text-xs text-slate-500 mt-1">A IA usará estas instruções quando o motivo de inaptidão do cliente contiver este texto.</p>
                          </div>

                          <div className="border-t border-slate-100 pt-6">
                             <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-slate-700 text-lg">Instruções para a IA</h4>
                                <button 
                                   onClick={() => setEditingRule({
                                      ...editingRule,
                                      instructions: [...(editingRule.instructions || []), { id: Date.now().toString(), title: '', type: 'simple', content: '' }]
                                   })}
                                   className="text-sm btn-secondary py-1.5 px-3 flex items-center gap-2"
                                >
                                   <Plus size={16}/> Adicionar Bloco
                                </button>
                             </div>
                             
                             <div className="space-y-4">
                                {(editingRule.instructions || []).map((inst, idx) => (
                                   <div key={inst.id} className="bg-slate-50 p-5 rounded-xl border border-slate-200 group relative hover:border-brand-200 hover:shadow-sm transition-all">
                                      <div className="flex gap-4 mb-3">
                                         <div className="flex-1">
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Título do Bloco</label>
                                            <input 
                                                className="w-full bg-transparent font-bold text-slate-800 outline-none border-b border-transparent focus:border-brand-300 pb-1"
                                                value={inst.title}
                                                onChange={e => {
                                                   const newInsts = [...(editingRule.instructions || [])];
                                                   newInsts[idx].title = e.target.value;
                                                   setEditingRule({...editingRule, instructions: newInsts});
                                                }}
                                                placeholder="Ex: Argumento de Venda"
                                            />
                                         </div>
                                      </div>
                                      <div>
                                         <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Conteúdo / Script</label>
                                         <textarea 
                                            className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-600 focus:border-brand-400 focus:ring-2 focus:ring-brand-50 outline-none resize-none"
                                            rows={3}
                                            value={inst.content}
                                            onChange={e => {
                                               const newInsts = [...(editingRule.instructions || [])];
                                               newInsts[idx].content = e.target.value;
                                               setEditingRule({...editingRule, instructions: newInsts});
                                            }}
                                            placeholder="O que a IA deve saber ou falar neste ponto..."
                                         />
                                      </div>
                                      <button 
                                         onClick={() => {
                                            const newInsts = (editingRule.instructions || []).filter((_, i) => i !== idx);
                                            setEditingRule({...editingRule, instructions: newInsts});
                                         }}
                                         className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 p-1"
                                      >
                                         <Trash2 size={18} />
                                      </button>
                                   </div>
                                ))}
                             </div>
                          </div>
                       </div>
                  </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <button 
                       onClick={() => setEditingRule({
                          id: 'new-' + Date.now(),
                          motivoSituacao: '',
                          isActive: true,
                          instructions: []
                       })}
                       className="border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center p-8 text-slate-400 hover:border-brand-400 hover:text-brand-500 hover:bg-brand-50/50 transition-all min-h-[200px]"
                    >
                       <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 group-hover:bg-brand-100">
                          <Plus size={24} />
                       </div>
                       <span className="font-semibold">Adicionar Nova Regra</span>
                    </button>

                    {(aiConfig.knowledgeRules || []).map(rule => (
                       <div 
                          key={rule.id}
                          className="card-premium p-6 cursor-pointer hover:border-brand-300 group relative"
                          onClick={() => setEditingRule(rule)}
                       >
                          <div className="flex justify-between items-start mb-4">
                             <div className={`p-2 rounded-lg ${rule.isActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                <BookOpen size={20} />
                             </div>
                             <div className="flex gap-2">
                                <button 
                                   onClick={(e) => {
                                      e.stopPropagation();
                                      const newRules = aiConfig.knowledgeRules.filter(r => r.id !== rule.id);
                                      setAiConfig({...aiConfig, knowledgeRules: newRules});
                                   }}
                                   className="p-1 text-slate-300 hover:text-rose-500"
                                >
                                   <Trash2 size={16} />
                                </button>
                             </div>
                          </div>
                          <h4 className="font-bold text-slate-800 mb-2 line-clamp-2 min-h-[3rem]">
                             {rule.motivoSituacao || 'Sem Título'}
                          </h4>
                          <div className="flex items-center justify-between text-xs text-slate-500 mt-4 pt-4 border-t border-slate-50">
                             <span>{(rule.instructions || []).length} blocos de instrução</span>
                             <span className="font-medium text-brand-600 group-hover:translate-x-1 transition-transform">Editar &rarr;</span>
                          </div>
                       </div>
                    ))}
                 </div>
               )}
            </div>
          )}

          {/* CONFIGURAÇÕES */}
           {activeTab === 'settings' && (
              <div className="max-w-3xl mx-auto space-y-6">
                 <div className="card-premium p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                       <Bot className="text-brand-500" size={20} />
                       Personalidade da IA
                    </h3>
                    <p className="text-sm text-slate-500 mb-2">Defina quem é a IA e como ela deve se comportar.</p>
                    <textarea 
                       className="input-premium h-40 font-mono text-sm leading-relaxed"
                       value={aiConfig.persona}
                       onChange={e => setAiConfig({...aiConfig, persona: e.target.value})}
                    />
                 </div>

                 <div className="card-premium p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                       <Settings className="text-brand-500" size={20} />
                       Parâmetros do Modelo
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Modelo Gemini</label>
                          <select 
                             className="input-premium"
                             value={aiConfig.model}
                             onChange={e => setAiConfig({...aiConfig, model: e.target.value})}
                          >
                             <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado)</option>
                             <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                          </select>
                       </div>
                    </div>
                 </div>
              </div>
           )}

        </div>
      </main>
    </div>
  );
};

export default App;