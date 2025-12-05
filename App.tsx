import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  LayoutDashboard, Upload, MessageCircle, Bot, Settings, Menu, FileSpreadsheet, Search, Filter,
  CheckCircle2, AlertCircle, Send, RefreshCw, Megaphone, BookOpen, Plus, Power, Trash2, Terminal,
  Briefcase, AlertTriangle, MessageSquare, User, MoreVertical, Paperclip, Smile, Play, FileText, X, Save, Mic,
  BarChart3
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

// --- Main App Component ---

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Data States
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [stats, setStats] = useState({ total: 0, processed: 0, success: 0, errors: 0 });
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);

  // Filters State
  const [filters, setFilters] = useState({
    search: '',
    city: '',
    reason: '',
    hasAccountant: 'all', // all, yes, no
    status: 'all',
    hasPhone: 'all'
  });
  
  // Filter Options (Fetched from API)
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

  // Polling WhatsApp status & Chats
  useInterval(() => {
    fetchWhatsAppStatus();
    if (activeTab === 'whatsapp' && waSession.status === 'connected') {
      fetchChats();
      if (activeChat) fetchMessages(activeChat);
    }
  }, 3000);

  // Sync AI Rules with Backend
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
        
        // Calc Stats
        const success = data.filter((c: any) => c.status === 'Sucesso' || c.status === Status.SUCCESS).length;
        const errors = data.filter((c: any) => c.status !== 'Sucesso' && c.status !== Status.SUCCESS).length;
        setStats({ total: data.length, processed: data.length, success, errors });
      }
    } catch (error) {
      console.error("Failed to fetch companies", error);
    } finally {
      setIsLoadingCompanies(false);
    }
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


  // --- Render Helpers ---

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

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-brand-950 text-white transition-all duration-300 flex flex-col shadow-2xl z-20`}>
        <div className="p-4 flex items-center justify-between border-b border-brand-800/50">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
                <span className="font-bold text-white text-lg">V</span>
              </div>
              <span className="font-bold text-lg tracking-tight">CRM VÍRGULA</span>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <span className="font-bold text-white">V</span>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-brand-800 rounded-lg transition-colors">
            <Menu size={18} className="text-brand-200" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'import', icon: Upload, label: 'Importar PDF' },
            { id: 'companies', icon: FileSpreadsheet, label: 'Base de Empresas' },
            { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', badge: waSession.status === 'connected' ? 'On' : 'Off' },
            { id: 'knowledge', icon: BookOpen, label: 'Base de Conhecimento' },
            { id: 'settings', icon: Settings, label: 'Configurações IA' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${
                activeTab === item.id 
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50' 
                  : 'text-brand-200 hover:bg-brand-900/50 hover:text-white'
              }`}
            >
              <item.icon size={20} className={activeTab === item.id ? 'animate-pulse' : ''} />
              {isSidebarOpen && (
                <>
                  <span className="font-medium text-sm flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      item.badge === 'On' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {!isSidebarOpen && activeTab === item.id && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-brand-800 text-xs rounded shadow-lg whitespace-nowrap z-50">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-brand-800/50 bg-brand-900/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-700 flex items-center justify-center border-2 border-brand-600">
              <User size={16} className="text-brand-200" />
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">Usuário Admin</p>
                <p className="text-xs text-brand-300 truncate">admin@virgula.com</p>
              </div>
            )}
            {isSidebarOpen && <Power size={16} className="text-brand-400 cursor-pointer hover:text-white" />}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50/50">
        <header className="sticky top-0 z-10 glass-effect px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            {activeTab === 'dashboard' && 'Visão Geral'}
            {activeTab === 'import' && 'Importação de Dados'}
            {activeTab === 'companies' && 'Base de Empresas'}
            {activeTab === 'whatsapp' && 'Atendimento WhatsApp'}
            {activeTab === 'knowledge' && 'Base de Conhecimento'}
            {activeTab === 'settings' && 'Configurações'}
          </h1>
          <div className="flex items-center gap-4">
            <div className="bg-white border border-slate-200 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-sm text-sm text-slate-600">
              <div className={`w-2 h-2 rounded-full ${waSession.status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {waSession.status === 'connected' ? 'WhatsApp Online' : 'WhatsApp Offline'}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto animate-fade-in pb-20">
          
          {/* --- DASHBOARD --- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total de Empresas', value: stats.total, color: 'text-brand-600', bg: 'bg-brand-50' },
                  { label: 'Processadas', value: stats.processed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Erros de Leitura', value: stats.errors, color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Aguardando Contato', value: stats.success, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map((stat, i) => (
                  <div key={i} className="card-premium p-6 hover:scale-[1.02] transition-transform">
                    <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                    <div className="flex items-baseline gap-2">
                      <h3 className={`text-3xl font-bold ${stat.color}`}>{stat.value}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stat.bg} ${stat.color}`}>+12%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card-premium p-6">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <BarChart3 className="text-brand-500" size={20} />
                    Distribuição por Cidade
                  </h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={companies.slice(0, 5).map(c => ({ name: c.municipio, value: 1 }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card-premium p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Upload className="text-brand-500" size={20} />
                    Histórico de Importações
                  </h3>
                  <div className="overflow-y-auto h-64 custom-scrollbar pr-2">
                    <div className="space-y-3">
                      {imports.map((imp) => (
                        <div key={imp.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-rose-500">
                              <FileText size={20} />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-slate-800">{imp.filename}</p>
                              <p className="text-xs text-slate-500">{new Date(imp.date).toLocaleDateString()} • {imp.total} registros</p>
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            imp.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {imp.status === 'completed' ? 'Concluído' : 'Processando'}
                          </span>
                        </div>
                      ))}
                      {imports.length === 0 && <p className="text-center text-slate-400 py-8">Nenhuma importação recente.</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --- IMPORT --- */}
          {activeTab === 'import' && (
            <div className="max-w-2xl mx-auto mt-10">
              <div className="card-premium p-8 text-center border-2 border-dashed border-slate-300 hover:border-brand-400 transition-colors group cursor-pointer relative">
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
                        alert(`Processamento iniciado! ID: ${processId}`);
                        fetchImports();
                      } else {
                        alert('Erro ao enviar arquivo.');
                      }
                    } catch (err) { console.error(err); alert('Erro de conexão.'); }
                  }}
                />
                <div className="w-20 h-20 bg-brand-50 text-brand-500 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Arraste seu PDF da SEFAZ aqui</h3>
                <p className="text-slate-500 mb-6">Ou clique para selecionar um arquivo do computador</p>
                <div className="inline-block bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium shadow-sm">
                  Suporta arquivos .PDF (Lista de IEs)
                </div>
              </div>
              
              <div className="mt-8 bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100 flex items-start gap-3">
                <AlertCircle size={20} className="mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-bold mb-1">Como funciona?</p>
                  <p>O sistema lê as Inscrições Estaduais do PDF, acessa o site da SEFAZ BA automaticamente e captura a situação cadastral e o motivo da inaptidão de cada empresa.</p>
                </div>
              </div>
            </div>
          )}

          {/* --- COMPANIES (With Advanced Filters) --- */}
          {activeTab === 'companies' && (
            <div className="space-y-6">
              {/* Filter Bar */}
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
                  <div className="flex gap-2">
                    <button onClick={fetchCompanies} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Atualizar Lista">
                      <RefreshCw size={20} />
                    </button>
                    <button 
                      onClick={() => setFilters({ search: '', city: '', reason: '', hasAccountant: 'all', status: 'all', hasPhone: 'all' })}
                      className="text-sm text-brand-600 font-medium hover:underline px-2"
                    >
                      Limpar Filtros
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <select 
                    className="input-premium py-2 text-sm"
                    value={filters.city}
                    onChange={e => setFilters({...filters, city: e.target.value})}
                  >
                    <option value="">Todas as Cidades</option>
                    {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>

                  <select 
                    className="input-premium py-2 text-sm"
                    value={filters.reason}
                    onChange={e => setFilters({...filters, reason: e.target.value})}
                  >
                    <option value="">Todos os Motivos</option>
                    {availableReasons.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>

                  <select 
                    className="input-premium py-2 text-sm"
                    value={filters.hasAccountant}
                    onChange={e => setFilters({...filters, hasAccountant: e.target.value})}
                  >
                    <option value="all">Contador: Todos</option>
                    <option value="yes">Com Contador</option>
                    <option value="no">Sem Contador</option>
                  </select>

                   <select 
                    className="input-premium py-2 text-sm"
                    value={filters.hasPhone}
                    onChange={e => setFilters({...filters, hasPhone: e.target.value})}
                  >
                    <option value="all">Telefone: Todos</option>
                    <option value="yes">Com Telefone</option>
                    <option value="no">Sem Telefone</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="card-premium overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4">Empresa</th>
                        <th className="px-6 py-4">Localização</th>
                        <th className="px-6 py-4">Contato</th>
                        <th className="px-6 py-4">Situação</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {isLoadingCompanies ? (
                         <tr><td colSpan={6} className="p-8 text-center text-slate-400">Carregando dados...</td></tr>
                      ) : filteredCompanies.length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhuma empresa encontrada com estes filtros.</td></tr>
                      ) : (
                        filteredCompanies.map((company) => (
                          <tr key={company.id} className="hover:bg-slate-50/80 transition-colors group">
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
                              ) : (
                                <span className="text-slate-400 italic">Não informado</span>
                              )}
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
                            <td className="px-6 py-4 text-right">
                              <button className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                <MoreVertical size={18} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 flex justify-between">
                  <span>Mostrando {filteredCompanies.length} de {companies.length} empresas</span>
                </div>
              </div>
            </div>
          )}

          {/* --- WHATSAPP --- */}
          {activeTab === 'whatsapp' && (
            <div className="flex h-[calc(100vh-140px)] gap-6">
              {/* Chat List */}
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
                        <div className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">Online</div>
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

              {/* Chat Window */}
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
                                  <span className="text-rose-500 flex items-center gap-1"><Power size={10}/> IA Desativada</span>
                                ) : (
                                  <span className="text-emerald-500 flex items-center gap-1"><Bot size={10}/> IA Ativa</span>
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
                                 <span className="text-[10px] text-slate-400 block text-right mt-1 opacity-70">
                                   {new Date(msg.timestamp * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                 </span>
                              </div>
                           </div>
                        ))}
                     </div>

                     <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                        <button className="p-2 text-slate-400 hover:text-brand-600 transition-colors"><Paperclip size={20} /></button>
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
                     <p>Selecione uma conversa para iniciar o atendimento</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- KNOWLEDGE BASE --- */}
          {activeTab === 'knowledge' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                 <button 
                    onClick={() => {
                       setEditingRule({
                          id: Date.now().toString(),
                          motivoSituacao: 'Novo Motivo',
                          isActive: true,
                          instructions: []
                       });
                    }}
                    className="w-full btn-primary justify-between"
                 >
                    <span className="flex items-center gap-2"><Plus size={18} /> Nova Regra</span>
                 </button>
                 
                 <div className="space-y-3">
                    {aiConfig.knowledgeRules.map(rule => (
                       <div 
                          key={rule.id}
                          onClick={() => setEditingRule(rule)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                             editingRule?.id === rule.id 
                             ? 'bg-brand-50 border-brand-500 shadow-md ring-1 ring-brand-500/20' 
                             : 'bg-white border-slate-200 hover:border-brand-300 hover:shadow-sm'
                          }`}
                       >
                          <div className="flex justify-between items-start mb-2">
                             <h4 className="font-semibold text-sm text-slate-800 line-clamp-2">{rule.motivoSituacao}</h4>
                             <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${rule.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          </div>
                          <p className="text-xs text-slate-500">{rule.instructions.length} instruções cadastradas</p>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="lg:col-span-2">
                 {editingRule ? (
                    <div className="card-premium p-6 animate-slide-up">
                       <div className="flex justify-between items-center mb-6">
                          <h3 className="text-lg font-bold flex items-center gap-2">
                             <Briefcase className="text-brand-500" size={20} />
                             Editando Regra
                          </h3>
                          <div className="flex gap-2">
                             <button 
                                onClick={() => {
                                   const newRules = aiConfig.knowledgeRules.filter(r => r.id !== editingRule.id);
                                   setAiConfig({...aiConfig, knowledgeRules: newRules});
                                   setEditingRule(null);
                                }}
                                className="btn-ghost text-rose-500 hover:bg-rose-50"
                             >
                                <Trash2 size={18} />
                             </button>
                             <button 
                                onClick={() => {
                                   const exists = aiConfig.knowledgeRules.find(r => r.id === editingRule.id);
                                   let newRules;
                                   if (exists) {
                                      newRules = aiConfig.knowledgeRules.map(r => r.id === editingRule.id ? editingRule : r);
                                   } else {
                                      newRules = [...aiConfig.knowledgeRules, editingRule];
                                   }
                                   setAiConfig({...aiConfig, knowledgeRules: newRules});
                                   setEditingRule(null);
                                }}
                                className="btn-primary"
                             >
                                <Save size={18} /> Salvar
                             </button>
                          </div>
                       </div>

                       <div className="space-y-4">
                          <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Gatilho (Motivo SEFAZ)</label>
                             <input 
                                type="text" 
                                className="input-premium"
                                value={editingRule.motivoSituacao}
                                onChange={e => setEditingRule({...editingRule, motivoSituacao: e.target.value})}
                                placeholder="Ex: Art. 27 - Inc. XVIII - MEI"
                             />
                          </div>

                          <div className="border-t border-slate-100 pt-4">
                             <div className="flex justify-between items-center mb-4">
                                <h4 className="font-semibold text-slate-700">Instruções para a IA</h4>
                                <button 
                                   onClick={() => setEditingRule({
                                      ...editingRule,
                                      instructions: [...editingRule.instructions, { id: Date.now().toString(), title: 'Nova Instrução', type: 'simple', content: '' }]
                                   })}
                                   className="text-xs btn-secondary py-1.5 px-3"
                                >
                                   + Adicionar Passo
                                </button>
                             </div>
                             
                             <div className="space-y-4">
                                {editingRule.instructions.map((inst, idx) => (
                                   <div key={inst.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 group">
                                      <div className="flex gap-3 mb-2">
                                         <input 
                                            className="bg-transparent font-medium text-sm text-brand-700 placeholder-brand-300 outline-none flex-1"
                                            value={inst.title}
                                            onChange={e => {
                                               const newInsts = [...editingRule.instructions];
                                               newInsts[idx].title = e.target.value;
                                               setEditingRule({...editingRule, instructions: newInsts});
                                            }}
                                            placeholder="Título (Ex: Solução)"
                                         />
                                         <button 
                                            onClick={() => {
                                               const newInsts = editingRule.instructions.filter((_, i) => i !== idx);
                                               setEditingRule({...editingRule, instructions: newInsts});
                                            }}
                                            className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                         >
                                            <X size={16} />
                                         </button>
                                      </div>
                                      <textarea 
                                         className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm text-slate-600 focus:border-brand-400 outline-none resize-none"
                                         rows={3}
                                         value={inst.content}
                                         onChange={e => {
                                            const newInsts = [...editingRule.instructions];
                                            newInsts[idx].content = e.target.value;
                                            setEditingRule({...editingRule, instructions: newInsts});
                                         }}
                                         placeholder="O que a IA deve saber/falar sobre isso..."
                                      />
                                   </div>
                                ))}
                             </div>
                          </div>
                       </div>
                    </div>
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                       <BookOpen size={48} className="mb-4 text-slate-300" />
                       <p>Selecione uma regra para editar</p>
                    </div>
                 )}
              </div>
            </div>
          )}

           {/* --- SETTINGS --- */}
           {activeTab === 'settings' && (
              <div className="max-w-3xl mx-auto space-y-6">
                 <div className="card-premium p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                       <Bot className="text-brand-500" size={20} />
                       Personalidade da IA
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">
                       Defina como o agente deve se comportar. Isso afeta o tom de voz e a abordagem no WhatsApp.
                    </p>
                    <textarea 
                       className="input-premium h-40 font-mono text-sm leading-relaxed"
                       value={aiConfig.persona}
                       onChange={e => setAiConfig({...aiConfig, persona: e.target.value})}
                    />
                 </div>

                 <div className="card-premium p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                       <Terminal className="text-brand-500" size={20} />
                       Parâmetros do Modelo
                    </h3>
                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Modelo</label>
                          <select 
                             className="input-premium"
                             value={aiConfig.model}
                             onChange={e => setAiConfig({...aiConfig, model: e.target.value})}
                          >
                             <option value="gemini-2.5-flash">Gemini 2.5 Flash (Rápido)</option>
                             <option value="gemini-1.5-pro">Gemini 1.5 Pro (Raciocínio)</option>
                          </select>
                       </div>
                       <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                             Criatividade (Temperatura): {aiConfig.temperature}
                          </label>
                          <input 
                             type="range" 
                             min="0" max="1" step="0.1"
                             className="w-full accent-brand-600"
                             value={aiConfig.temperature}
                             onChange={e => setAiConfig({...aiConfig, temperature: parseFloat(e.target.value)})}
                          />
                          <div className="flex justify-between text-xs text-slate-400 mt-1">
                             <span>Preciso</span>
                             <span>Criativo</span>
                          </div>
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