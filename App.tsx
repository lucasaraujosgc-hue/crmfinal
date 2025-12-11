import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Upload, MessageCircle, Bot, Settings, Menu, FileSpreadsheet, Search,
  CheckCircle2, AlertCircle, Send, RefreshCw, BookOpen, Plus, Trash2,
  Briefcase, MessageSquare, User, Paperclip, Mic, X, Save,
  BarChart3, Rocket, Sparkles, CheckSquare, Square, Trello, MoreHorizontal, PauseCircle, PlayCircle
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

// --- EXTRACTED COMPONENTS (To fix focus issues) ---

const FilterBar = ({ filters, setFilters, availableCities, availableReasons, onRefresh }: any) => (
  <div className="card-premium p-4 flex flex-col gap-4 mb-6">
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Buscar por Nome, IE ou CNPJ..." 
          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
          value={filters.search}
          onChange={e => setFilters((prev: any) => ({...prev, search: e.target.value}))}
        />
      </div>
      <button onClick={onRefresh} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><RefreshCw size={20} /></button>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <select className="input-premium py-2 text-sm" value={filters.city} onChange={e => setFilters((prev: any) => ({...prev, city: e.target.value}))}>
        <option value="">Todas as Cidades</option>
        {availableCities.map((c: string) => <option key={c} value={c}>{c}</option>)}
      </select>

      <select className="input-premium py-2 text-sm" value={filters.reason} onChange={e => setFilters((prev: any) => ({...prev, reason: e.target.value}))}>
        <option value="">Todos os Motivos</option>
        {availableReasons.map((r: string) => <option key={r} value={r}>{r}</option>)}
      </select>

      <select className="input-premium py-2 text-sm" value={filters.statusWa} onChange={e => setFilters((prev: any) => ({...prev, statusWa: e.target.value}))}>
        <option value="all">Status WhatsApp: Todos</option>
        <option value="pending">Pendente</option>
        <option value="queued">Na Fila</option>
        <option value="sent">Enviado</option>
        <option value="replied">Respondeu</option>
        <option value="interested">Interessado</option>
        <option value="not_interested">Descartado</option>
        <option value="error">Erro Envio</option>
      </select>

      <select className="input-premium py-2 text-sm" value={filters.hasAccountant} onChange={e => setFilters((prev: any) => ({...prev, hasAccountant: e.target.value}))}>
        <option value="all">Contador: Todos</option>
        <option value="yes">Com Contador</option>
        <option value="no">Sem Contador</option>
      </select>

      <select className="input-premium py-2 text-sm" value={filters.hasPhone} onChange={e => setFilters((prev: any) => ({...prev, hasPhone: e.target.value}))}>
        <option value="all">Telefone: Todos</option>
        <option value="yes">Com Telefone</option>
        <option value="no">Sem Telefone</option>
      </select>
    </div>
  </div>
);

const CompanyTable = ({ companies, selectedIds, toggleSelection, toggleSelectAll, selectable = false }: any) => (
    <div className="card-premium overflow-hidden relative">
      <table className="w-full text-sm text-left mt-2">
        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
          <tr>
            {selectable && (
              <th className="px-4 py-4 w-10 text-center">
                  <button onClick={toggleSelectAll} className="hover:text-brand-600">
                  {selectedIds.size === companies.length && companies.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
              </th>
            )}
            <th className="px-6 py-4">Empresa</th>
            <th className="px-6 py-4">Situação</th>
            <th className="px-6 py-4">Status WhatsApp</th>
            <th className="px-6 py-4">Motivo</th>
            <th className="px-6 py-4">Município</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {companies.slice(0, 100).map((company: CompanyResult) => (
            <tr key={company.id} className={`hover:bg-slate-50/80 transition-colors ${selectedIds.has(company.id) ? 'bg-brand-50/30' : ''}`}>
              {selectable && (
                  <td className="px-4 py-4 text-center">
                  <button onClick={() => toggleSelection(company.id)} className={`${selectedIds.has(company.id) ? 'text-brand-600' : 'text-slate-300 hover:text-slate-400'}`}>
                      {selectedIds.has(company.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                  </button>
                  </td>
              )}
              <td className="px-6 py-4">
                <p className="font-semibold text-slate-900">{company.razaoSocial || 'Nome Indisponível'}</p>
                <p className="text-xs text-slate-500">{company.inscricaoEstadual} | {company.cnpj}</p>
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                  company.situacaoCadastral === 'ATIVA' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {company.situacaoCadastral}
                </span>
              </td>
              <td className="px-6 py-4">
                   <StatusBadge status={company.campaignStatus} />
              </td>
              <td className="px-6 py-4 text-xs text-slate-500 truncate max-w-[200px]" title={company.motivoSituacao}>
                  {company.motivoSituacao || 'N/D'}
              </td>
              <td className="px-6 py-4">{company.municipio}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
);

const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, string> = {
        'pending': 'bg-slate-100 text-slate-600',
        'queued': 'bg-amber-100 text-amber-700',
        'sent': 'bg-blue-100 text-blue-700',
        'replied': 'bg-purple-100 text-purple-700',
        'interested': 'bg-emerald-100 text-emerald-700',
        'not_interested': 'bg-rose-100 text-rose-700',
        'error': 'bg-red-100 text-red-700',
        'skipped': 'bg-gray-100 text-gray-500'
    };
    const labels: Record<string, string> = {
        'pending': 'Pendente',
        'queued': 'Fila',
        'sent': 'Enviado',
        'replied': 'Respondeu',
        'interested': 'Interessado',
        'not_interested': 'Descartado',
        'error': 'Erro',
        'skipped': 'Sem Zap'
    };
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${map[status] || map['pending']}`}>
            {labels[status] || status}
        </span>
    )
}

const KanbanCard = ({ company, onClick }: { company: CompanyResult, onClick: () => void }) => (
    <div onClick={onClick} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-brand-300 group">
        <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">{company.inscricaoEstadual}</span>
            {company.telefone && <MessageCircle size={14} className="text-brand-500"/>}
        </div>
        <h4 className="font-bold text-slate-800 text-sm mb-1 line-clamp-2">{company.razaoSocial}</h4>
        <p className="text-xs text-slate-500 mb-2 truncate">{company.municipio}</p>
        <div className="flex justify-between items-center border-t border-slate-50 pt-2">
             <StatusBadge status={company.campaignStatus} />
             <span className="text-[10px] text-slate-400">{new Date().toLocaleDateString()}</span>
        </div>
    </div>
);

const KanbanColumn = ({ title, status, companies, onMove, onCardClick }: any) => {
    return (
        <div className="min-w-[280px] w-[280px] flex flex-col h-full bg-slate-100/50 rounded-2xl border border-slate-200/60">
            <div className="p-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                        status === 'interested' ? 'bg-emerald-500' :
                        status === 'replied' ? 'bg-purple-500' :
                        status === 'sent' ? 'bg-blue-500' : 'bg-slate-400'
                    }`}></span>
                    {title}
                </h3>
                <span className="bg-white px-2 py-0.5 rounded text-xs font-bold text-slate-500 border border-slate-200">
                    {companies.length}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {companies.map((c: any) => (
                    <KanbanCard key={c.id} company={c} onClick={() => onCardClick(c)} />
                ))}
            </div>
        </div>
    )
}

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Data States
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, processed: 0, success: 0, errors: 0 });

  // Import Process State
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const [processProgress, setProcessProgress] = useState({ total: 0, processed: 0, status: '' });

  // Filters State
  const [filters, setFilters] = useState({
    search: '',
    city: '',
    reason: '',
    hasAccountant: 'all',
    status: 'all',
    statusWa: 'all',
    hasPhone: 'all'
  });
  
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableReasons, setAvailableReasons] = useState<string[]>([]);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Campaign Wizard State
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaignStep, setCampaignStep] = useState(1);
  const [newCampaign, setNewCampaign] = useState({
     name: '',
     description: '',
     initialMessage: 'Olá, tudo bem? Vi que sua empresa possui pendências na SEFAZ e gostaria de ajudar.',
     aiPersona: DEFAULT_AI_PERSONA
  });

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
    fetchCampaigns();
  }, []);

  useEffect(() => {
    setSelectedIds(new Set());
    setIsCreatingCampaign(false);
    setCampaignStep(1);
  }, [activeTab]);

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
                           fetchFilters(); // Update filters with new data
                           setTimeout(() => setCurrentProcessId(null), 3000);
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
      body: JSON.stringify({ rules: aiConfig.knowledgeRules, persona: aiConfig.persona })
    }).catch(console.error);
  }, [aiConfig.knowledgeRules, aiConfig.persona]);

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

  const fetchCampaigns = async () => {
      try {
          const res = await fetch('/api/campaigns');
          if (res.ok) setCampaigns(await res.json());
      } catch (e) { console.error(e); }
  };

  const fetchCompanies = async () => {
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
  };

  const fetchImports = async () => {
    try {
      const res = await fetch('/get-imports');
      if (res.ok) setImports(await res.json());
    } catch (e) { console.error(e); }
  };

  const deleteImport = async (id: string) => {
      if(!confirm('Tem certeza? Isso apagará todas as empresas desta lista.')) return;
      try {
          await fetch(`/api/imports/${id}`, { method: 'DELETE' });
          fetchImports();
          fetchCompanies();
      } catch(e) { alert('Erro ao deletar'); }
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
       // Placeholder for AI Toggle endpoint if implemented in backend
    } catch (e) { console.error(e); }
  };

  const createCampaign = async () => {
      if (!newCampaign.name || selectedIds.size === 0) return alert('Selecione empresas e dê um nome à campanha.');
      
      try {
          const res = await fetch('/api/campaigns', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  ...newCampaign,
                  leads: Array.from(selectedIds)
              })
          });
          if (res.ok) {
              alert('Campanha criada e envios iniciados!');
              setIsCreatingCampaign(false);
              fetchCampaigns();
              fetchCompanies();
          } else {
              alert('Erro ao criar campanha');
          }
      } catch (e) { alert('Erro de conexão'); }
  };

  const updateLeadStatus = async (id: string, status: string) => {
      try {
          await fetch('/api/leads/status', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ id, status })
          });
          fetchCompanies();
      } catch(e) { console.error(e); }
  };

  // --- Filtering Logic ---

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const searchMatch = !filters.search || 
        c.razaoSocial?.toLowerCase().includes(filters.search.toLowerCase()) ||
        c.inscricaoEstadual?.includes(filters.search) ||
        c.cnpj?.includes(filters.search);
        
      const cityMatch = !filters.city || c.municipio === filters.city;
      
      const reasonMatch = !filters.reason || 
        (c.motivoSituacao && c.motivoSituacao.toLowerCase().includes(filters.reason.toLowerCase()));
        
      const accountantMatch = filters.hasAccountant === 'all' ? true :
        filters.hasAccountant === 'yes' ? !!c.nomeContador : !c.nomeContador;
        
      const phoneMatch = filters.hasPhone === 'all' ? true :
        filters.hasPhone === 'yes' ? !!c.telefone : !c.telefone;

      const waMatch = filters.statusWa === 'all' ? true :
        c.campaignStatus === filters.statusWa;

      return searchMatch && cityMatch && reasonMatch && accountantMatch && phoneMatch && waMatch;
    });
  }, [companies, filters]);

  // --- Selection Logic ---

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCompanies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCompanies.map(c => c.id)));
    }
  };

  const openChatFromKanban = (company: CompanyResult) => {
      if(company.telefone) {
          const raw = company.telefone.replace(/\D/g, '');
          // Basic Brazil assumption
          const target = raw.length < 12 ? '55' + raw : raw;
          const chatId = target + '@c.us';
          setActiveTab('whatsapp');
          setActiveChat(chatId);
          fetchMessages(chatId);
      } else {
          alert('Empresa sem telefone cadastrado.');
      }
  };

  // --- Render ---

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans text-slate-900">
      
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
            { id: 'kanban', icon: Trello, label: 'Kanban Vendas' },
            { id: 'import', icon: Upload, label: 'Importar PDF' },
            { id: 'companies', icon: FileSpreadsheet, label: 'Base de Empresas' },
            { id: 'campaigns', icon: Rocket, label: 'Gestão de Campanhas' },
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

      <main className="flex-1 overflow-y-auto bg-slate-50 relative">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">
            {activeTab === 'dashboard' && 'Visão Geral'}
            {activeTab === 'kanban' && 'Gestão de Atendimentos'}
            {activeTab === 'import' && 'Importação de Dados'}
            {activeTab === 'companies' && 'Base de Empresas'}
            {activeTab === 'campaigns' && 'Campanhas de Marketing'}
            {activeTab === 'whatsapp' && 'Atendimento'}
            {activeTab === 'knowledge' && 'Base de Conhecimento'}
            {activeTab === 'settings' && 'Configurações'}
          </h1>
        </header>

        <div className="p-8 max-w-[1600px] mx-auto pb-20 h-[calc(100vh-80px)] overflow-y-auto">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total na Base', value: stats.total, color: 'text-brand-600', bg: 'bg-brand-50' },
                  { label: 'Sucesso Scraper', value: stats.success, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Erros Leitura', value: stats.errors, color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Campanhas Ativas', value: campaigns.length, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map((stat, i) => (
                  <div key={i} className="card-premium p-6 hover:-translate-y-1 transition-transform">
                    <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                    <h3 className="text-3xl font-bold text-slate-700">{stat.value}</h3>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-8">
              {!currentProcessId && (
                <div className="max-w-xl mx-auto card-premium p-10 text-center border-2 border-dashed border-slate-300 hover:border-brand-400 transition-all group cursor-pointer relative bg-white">
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
                  <h3 className="text-2xl font-bold text-slate-800 mb-2">Nova Importação SEFAZ</h3>
                  <p className="text-slate-500 text-lg">Arraste o PDF ou clique para selecionar</p>
                </div>
              )}

              {currentProcessId && (
                <div className="max-w-2xl mx-auto card-premium p-8 text-center animate-fade-in">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                    <RefreshCw size={32} className="animate-spin" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Processando PDF...</h3>
                  <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden mb-2">
                    <div 
                      className={`bg-brand-500 h-4 rounded-full transition-all duration-500 ease-out`}
                      style={{ width: `${processProgress.total > 0 ? (processProgress.processed / processProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="text-sm font-medium text-slate-600">
                    {processProgress.processed} de {processProgress.total} empresas consultadas
                  </p>
                </div>
              )}

              <div className="card-premium p-6">
                  <h3 className="text-lg font-bold mb-4 text-slate-800">Gerenciador de Arquivos</h3>
                  <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 text-slate-600 font-medium">
                              <tr>
                                  <th className="px-4 py-3">Nome do Arquivo</th>
                                  <th className="px-4 py-3">Data Importação</th>
                                  <th className="px-4 py-3">Total Registros</th>
                                  <th className="px-4 py-3">Status</th>
                                  <th className="px-4 py-3 text-right">Ações</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {imports.map(imp => (
                                  <tr key={imp.id} className="hover:bg-slate-50">
                                      <td className="px-4 py-3 font-medium text-slate-800">{imp.filename}</td>
                                      <td className="px-4 py-3 text-slate-500">{new Date(imp.date).toLocaleDateString()}</td>
                                      <td className="px-4 py-3 text-slate-600">{imp.total}</td>
                                      <td className="px-4 py-3">
                                          <span className={`text-xs px-2 py-1 rounded-full ${imp.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                              {imp.status === 'completed' ? 'Sucesso' : imp.status}
                                          </span>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                          <button onClick={() => deleteImport(imp.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                                              <Trash2 size={16}/>
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'companies' && (
            <div className="space-y-6">
              <FilterBar 
                filters={filters} 
                setFilters={setFilters} 
                availableCities={availableCities} 
                availableReasons={availableReasons}
                onRefresh={fetchCompanies}
              />
              <CompanyTable 
                companies={filteredCompanies} 
                selectedIds={selectedIds} 
                toggleSelection={toggleSelection} 
                toggleSelectAll={toggleSelectAll} 
              />
            </div>
          )}

          {activeTab === 'kanban' && (
              <div className="h-full flex gap-4 overflow-x-auto pb-4">
                  <KanbanColumn 
                    title="Envio Pendente" 
                    status="pending" 
                    companies={companies.filter(c => c.campaignStatus === 'pending' || c.campaignStatus === 'queued' || !c.campaignStatus)} 
                    onCardClick={openChatFromKanban}
                  />
                  <KanbanColumn 
                    title="Enviados" 
                    status="sent" 
                    companies={companies.filter(c => c.campaignStatus === 'sent' || c.campaignStatus === 'delivered')} 
                    onCardClick={openChatFromKanban}
                  />
                  <KanbanColumn 
                    title="Responderam" 
                    status="replied" 
                    companies={companies.filter(c => c.campaignStatus === 'replied')} 
                    onCardClick={openChatFromKanban}
                  />
                  <KanbanColumn 
                    title="Interessados" 
                    status="interested" 
                    companies={companies.filter(c => c.campaignStatus === 'interested')} 
                    onCardClick={openChatFromKanban}
                  />
                   <KanbanColumn 
                    title="Descartados" 
                    status="not_interested" 
                    companies={companies.filter(c => c.campaignStatus === 'not_interested' || c.campaignStatus === 'skipped' || c.campaignStatus === 'error')} 
                    onCardClick={openChatFromKanban}
                  />
              </div>
          )}

          {activeTab === 'campaigns' && (
            <div className="space-y-6">
               {!isCreatingCampaign ? (
                   <div className="space-y-6">
                       <div className="flex justify-between items-center">
                           <h2 className="text-xl font-bold text-slate-700">Minhas Campanhas</h2>
                           <button onClick={() => setIsCreatingCampaign(true)} className="btn-primary flex items-center gap-2">
                               <Plus size={18}/> Nova Campanha
                           </button>
                       </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {campaigns.map(c => (
                               <div key={c.id} className="card-premium p-6 group">
                                   <div className="flex justify-between items-start mb-4">
                                       <div className="p-3 bg-brand-50 text-brand-600 rounded-xl">
                                           <Rocket size={24}/>
                                       </div>
                                       <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-full uppercase">Ativa</span>
                                   </div>
                                   <h3 className="font-bold text-lg text-slate-800 mb-2">{c.name}</h3>
                                   <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-4">
                                       <div><p className="text-xs text-slate-400">Total</p><p className="font-bold">{c.stats?.total || 0}</p></div>
                                       <div><p className="text-xs text-slate-400">Enviados</p><p className="font-bold text-brand-600">{c.stats?.sent || 0}</p></div>
                                       <div><p className="text-xs text-slate-400">Respostas</p><p className="font-bold text-emerald-600">{c.stats?.replied || 0}</p></div>
                                   </div>
                               </div>
                           ))}
                       </div>
                   </div>
               ) : (
                   <div className="max-w-5xl mx-auto">
                       <div className="mb-8 flex items-center justify-between">
                           <div><h2 className="text-2xl font-bold text-slate-800">Criar Nova Campanha</h2></div>
                           <button onClick={() => setIsCreatingCampaign(false)}><X size={24}/></button>
                       </div>
                       <div className="card-premium p-8">
                           {campaignStep === 1 && (
                               <div className="max-w-xl mx-auto space-y-6">
                                   <input className="input-premium" placeholder="Nome da Campanha" value={newCampaign.name} onChange={e => setNewCampaign({...newCampaign, name: e.target.value})} />
                                   <textarea className="input-premium h-32" placeholder="Descrição" value={newCampaign.description} onChange={e => setNewCampaign({...newCampaign, description: e.target.value})} />
                                   <button onClick={() => setCampaignStep(2)} className="btn-primary w-full">Próximo</button>
                               </div>
                           )}
                           {campaignStep === 2 && (
                               <div className="space-y-4">
                                   <FilterBar filters={filters} setFilters={setFilters} availableCities={availableCities} availableReasons={availableReasons} onRefresh={fetchCompanies} />
                                   <div className="h-[400px] overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl">
                                      <CompanyTable companies={filteredCompanies} selectedIds={selectedIds} toggleSelection={toggleSelection} toggleSelectAll={toggleSelectAll} selectable={true} />
                                   </div>
                                   <div className="flex justify-between pt-4">
                                       <button onClick={() => setCampaignStep(1)} className="btn-secondary">Voltar</button>
                                       <button onClick={() => setCampaignStep(3)} className="btn-primary" disabled={selectedIds.size === 0}>Próximo ({selectedIds.size})</button>
                                   </div>
                               </div>
                           )}
                           {campaignStep === 3 && (
                               <div className="grid grid-cols-2 gap-8">
                                   <textarea className="input-premium h-64" value={newCampaign.initialMessage} onChange={e => setNewCampaign({...newCampaign, initialMessage: e.target.value})} />
                                   <textarea className="input-premium h-64" value={newCampaign.aiPersona} onChange={e => setNewCampaign({...newCampaign, aiPersona: e.target.value})} />
                                   <button onClick={createCampaign} className="btn-primary col-span-2">Disparar</button>
                               </div>
                           )}
                       </div>
                   </div>
               )}
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className="flex h-full gap-6">
              <div className="w-1/3 card-premium flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
                   {waSession.status !== 'connected' && waSession.qrCode ? (
                      <div className="text-center p-4">
                         <img src={waSession.qrCode} alt="QR Code" className="w-48 h-48 mx-auto" />
                         <p className="text-sm font-medium text-slate-600 animate-pulse mt-2">Escaneie para conectar</p>
                      </div>
                   ) : (
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-700">Conversas</h3>
                        <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full">{waSession.status}</span>
                      </div>
                   )}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                   {chats.map(chat => (
                      <div key={chat.id} onClick={() => { setActiveChat(chat.id); fetchMessages(chat.id); }} className={`p-4 border-b hover:bg-slate-50 cursor-pointer ${activeChat === chat.id ? 'bg-brand-50 border-l-4 border-l-brand-500' : ''}`}>
                         <h4 className="font-semibold text-sm truncate">{chat.name}</h4>
                         <p className="text-xs text-slate-500 truncate">{chat.lastMessage}</p>
                      </div>
                   ))}
                </div>
              </div>
              <div className="flex-1 card-premium flex flex-col">
                {activeChat ? (
                  <>
                     <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold">{chats.find(c => c.id === activeChat)?.name}</h3>
                        <div className="flex gap-2">
                             <button onClick={() => {
                                 const comp = companies.find(c => activeChat.includes(c.telefone?.replace(/\D/g, '') || 'XXX'));
                                 if(comp) updateLeadStatus(comp.id, 'interested');
                             }} className="text-xs px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200">Marcar Interessado</button>
                             <button onClick={() => {
                                 const comp = companies.find(c => activeChat.includes(c.telefone?.replace(/\D/g, '') || 'XXX'));
                                 if(comp) updateLeadStatus(comp.id, 'not_interested');
                             }} className="text-xs px-3 py-1 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200">Descartar</button>
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#efeae2]">
                        {chatMessages.map(msg => (
                           <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[70%] rounded-xl p-3 shadow-sm text-sm ${msg.fromMe ? 'bg-[#d9fdd3]' : 'bg-white'}`}>
                                 {msg.hasMedia && <div className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Paperclip size={12}/> Mídia</div>}
                                 <p className="whitespace-pre-wrap">{msg.body}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                     <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                        <input type="text" className="flex-1 bg-slate-100 rounded-full px-4 py-2 outline-none" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                        <button onClick={sendMessage} className="p-2 bg-brand-600 text-white rounded-full"><Send size={18} /></button>
                     </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400">Selecione uma conversa</div>
                )}
              </div>
            </div>
          )}

           {activeTab === 'knowledge' && (
              <div className="max-w-4xl mx-auto">
                 {/* Simplified for brevity - Assume Knowledge Base UI remains similar but uses editingRule state */}
                 <div className="card-premium p-8 text-center"><p className="text-slate-500">Gestão da Base de Conhecimento (Utilize as configurações iniciais ou edite via API)</p></div>
              </div>
           )}

        </div>
      </main>
    </div>
  );
};

export default App;