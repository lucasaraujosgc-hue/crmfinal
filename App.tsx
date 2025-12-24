import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Upload, MessageCircle, Bot, Settings, Menu, FileSpreadsheet, Search,
  CheckCircle2, AlertCircle, Send, RefreshCw, BookOpen, Plus, Trash2,
  Briefcase, MessageSquare, User, Paperclip, Mic, X, Save,
  BarChart3, Rocket, Sparkles, CheckSquare, Square, Trello, MoreHorizontal, PauseCircle, PlayCircle, Edit,
  ToggleLeft, ToggleRight, Power, Phone, MoreVertical, Smile, Paperclip as PaperclipIcon, Check, Eye, EyeOff, Cpu
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { CompanyResult, Status, CampaignStatus, KnowledgeRule, AIConfig, WhatsAppSession, ImportBatch, Instruction } from './types';
import { DEFAULT_KNOWLEDGE_RULES, DEFAULT_AI_PERSONA } from './constants';
import { v4 as uuidv4 } from 'uuid';

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

// --- HELPERS ---

const cleanReasonText = (text: string | null | undefined) => {
    if (!text) return '';
    return text.split('Endereço de Correspondência')[0]
               .split('Endereço:')[0]
               .split('Endereco de Correspondencia')[0]
               .trim();
};

const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getInitials = (name: string) => {
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

// --- COMPONENTS ---

const FilterBar = React.memo(({ filters, setFilters, availableCities, availableReasons, onRefresh }: any) => (
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
        <option value="queued">Fila</option>
        <option value="sent">Enviado</option>
        <option value="replied">Respondeu</option>
        <option value="interested">Interessado</option>
        <option value="not_interested">Descartado</option>
        <option value="error">Erro</option>
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
));

const CompanyTable = React.memo(({ companies, selectedIds, toggleSelection, toggleSelectAll, selectable = false, onToggleAi }: any) => (
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
            <th className="px-6 py-4 w-[350px]">Empresa</th>
            <th className="px-6 py-4">Situação</th>
            <th className="px-6 py-4">Status WhatsApp</th>
            <th className="px-6 py-4 text-center">IA Ativa</th>
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
                <div className="flex flex-col gap-1.5">
                    <p className="font-bold text-slate-800 text-sm leading-tight">{company.razaoSocial?.replace('Razão Social:', '').trim() || 'N/D'}</p>
                    {company.nomeFantasia && company.nomeFantasia !== company.razaoSocial && (
                         <p className="text-xs text-slate-500 font-medium uppercase">{company.nomeFantasia.replace('Nome Fantasia:', '').trim()}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="bg-white border border-slate-200 text-[10px] px-1.5 py-0.5 rounded text-slate-600 font-mono">
                           CNPJ: {company.cnpj?.replace('CNPJ:', '').trim()}
                        </span>
                        <span className="bg-white border border-slate-200 text-[10px] px-1.5 py-0.5 rounded text-slate-600 font-mono">
                           IE: {company.inscricaoEstadual?.replace('Inscrição Estadual:', '').trim()}
                        </span>
                    </div>
                    {company.dataSituacaoCadastral && (
                        <div className="flex items-center gap-1 mt-1 text-rose-600">
                            <AlertCircle size={10} />
                            <span className="text-[10px] font-bold">Desde: {company.dataSituacaoCadastral}</span>
                        </div>
                    )}
                </div>
              </td>
              <td className="px-6 py-4 align-top">
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  company.situacaoCadastral?.toUpperCase().includes('ATIVA') 
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                  : 'bg-rose-100 text-rose-700 border border-rose-200'
                }`}>
                  {company.situacaoCadastral?.replace('Situação Cadastral Vigente:', '').trim() || 'N/D'}
                </span>
              </td>
              <td className="px-6 py-4 align-top">
                   <StatusBadge status={company.campaignStatus} />
              </td>
              <td className="px-6 py-4 align-top text-center">
                  <button 
                    onClick={() => onToggleAi && onToggleAi(company.id, company.aiActive)}
                    className={`p-1.5 rounded-full transition-colors ${
                        company.aiActive 
                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100' 
                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-100'
                    }`}
                  >
                      {company.aiActive ? <Bot size={18} /> : <Power size={18} />}
                  </button>
              </td>
              <td className="px-6 py-4 align-top text-xs text-slate-500 truncate max-w-[200px]" title={company.motivoSituacao}>
                  {cleanReasonText(company.motivoSituacao || 'N/D')}
              </td>
              <td className="px-6 py-4 align-top font-medium text-slate-700">{company.municipio?.replace('Município:', '').trim() || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
));

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
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${map[status] || map['pending']}`}>
            {status}
        </span>
    )
}

const KanbanCard: React.FC<{ company: CompanyResult, onClick: () => void }> = ({ company, onClick }) => (
    <div onClick={onClick} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-brand-300 group">
        <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">{company.inscricaoEstadual}</span>
            <div className="flex gap-1">
                {company.aiActive && <Bot size={14} className="text-emerald-500" />}
                {company.telefone && <MessageCircle size={14} className="text-brand-500"/>}
            </div>
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
        <div className="min-w-[280px] w-[280px] flex flex-col h-full bg-slate-100/50 rounded-2xl border border-slate-200/60 flex-shrink-0">
            <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-white/50 rounded-t-2xl">
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

const SelectedLeadModal = ({ company, onClose, onGoToChat }: any) => {
    if (!company) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="text-xl font-bold text-slate-800">Detalhes do Lead</h3>
                    <button onClick={onClose}><X className="text-slate-400 hover:text-slate-600" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-xs text-slate-500 uppercase font-bold">Empresa</label>
                        <p className="text-lg font-semibold text-slate-900">{company.razaoSocial}</p>
                        <p className="text-sm text-slate-500">{company.cnpj} | IE: {company.inscricaoEstadual}</p>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 uppercase font-bold">Motivo da Inaptidão</label>
                        <div className="bg-rose-50 text-rose-800 p-3 rounded-lg text-sm border border-rose-100">
                            {company.motivoSituacao || 'Não informado'}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                         <button onClick={onClose} className="btn-secondary">Fechar</button>
                         <button onClick={() => onGoToChat(company)} className="btn-primary" disabled={!company.telefone}>
                             <MessageCircle size={18} /> WhatsApp
                         </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

const ApiKeyInput = ({ label, provider, currentKey, onChange, activeProvider }: any) => {
    const [show, setShow] = useState(false);
    return (
        <div className={`p-4 rounded-xl border transition-all ${activeProvider === provider ? 'bg-brand-50 border-brand-200' : 'bg-white border-slate-200'}`}>
            <label className="block text-sm font-medium text-slate-700 mb-2">
                {label} {activeProvider === provider && " (ATIVO)"}
            </label>
            <div className="relative">
                <input 
                    type={show ? "text" : "password"}
                    className="input-premium pr-10"
                    value={currentKey || ''}
                    onChange={(e) => onChange(provider, e.target.value)}
                />
                <button onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
        </div>
    );
};

// --- APP COMPONENT ---

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, processed: 0, success: 0, errors: 0 });
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const [processProgress, setProcessProgress] = useState({ total: 0, processed: 0, status: '' });
  
  const [filters, setFilters] = useState({
    search: '', city: '', reason: '', hasAccountant: 'all', status: 'all', statusWa: 'all', hasPhone: 'all'
  });
  
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableReasons, setAvailableReasons] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedKanbanLead, setSelectedKanbanLead] = useState<CompanyResult | null>(null);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaignStep, setCampaignStep] = useState(1);
  const [newCampaign, setNewCampaign] = useState({
     name: '', description: '', initialMessage: 'Olá, tudo bem?', aiPersona: DEFAULT_AI_PERSONA
  });

  const [aiConfig, setAiConfig] = useLocalStorage<AIConfig>('crm_ai_config', {
    model: 'gemini-3-flash-preview', provider: 'gemini', apiKeys: { gemini: '', groq: '' },
    persona: DEFAULT_AI_PERSONA, knowledgeRules: [], temperature: 0.7, aiActive: true
  });
  const [editingRule, setEditingRule] = useState<KnowledgeRule | null>(null);
  const [waSession, setWaSession] = useState<WhatsAppSession>({ status: 'disconnected' });
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    fetchCompanies();
    fetchImports();
    fetchFilters();
    fetchCampaigns();
  }, []);

  useInterval(() => {
    fetchWhatsAppStatus();
    if (activeTab === 'whatsapp' && waSession.status === 'connected') {
      fetchChats();
      if (activeChat) fetchMessages(activeChat);
    }
  }, 4000);

  const fetchFilters = async () => {
    try {
      const res = await fetch('/api/unique-filters');
      if (res.ok) {
        const data = await res.json();
        setAvailableCities(data.municipios || []);
        setAvailableReasons(data.motivos || []); // Motivos puros do banco
      }
    } catch (e) { console.error(e); }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/get-all-results');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
        const success = data.filter((c: any) => c.status === 'Sucesso').length;
        setStats({ total: data.length, processed: data.length, success, errors: data.length - success });
      }
    } catch (error) { console.error(error); } 
  };

  const fetchImports = async () => {
    try {
      const res = await fetch('/get-imports');
      if (res.ok) setImports(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchCampaigns = async () => {
      try {
          const res = await fetch('/api/campaigns');
          if (res.ok) setCampaigns(await res.json());
      } catch (e) { console.error(e); }
  };

  const saveAiConfig = async (newConfig: AIConfig) => {
      setIsSavingConfig(true);
      try {
          const res = await fetch('/api/config/ai-rules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  rules: newConfig.knowledgeRules,
                  persona: newConfig.persona,
                  temperature: newConfig.temperature,
                  model: newConfig.model,
                  aiActive: newConfig.aiActive,
                  provider: newConfig.provider,
                  apiKeys: newConfig.apiKeys
              })
          });
          if (res.ok) {
              const data = await res.json();
              setAiConfig(data.config || newConfig);
              alert('Configurações aplicadas!');
          }
      } catch (e) { console.error(e); } finally { setIsSavingConfig(false); }
  }

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
      setChatMessages(prev => [...prev, { id: Date.now().toString(), fromMe: true, body: newMessage, timestamp: Date.now()/1000 }]);
      await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChat, message: newMessage })
      });
      setNewMessage('');
      fetchMessages(activeChat);
    } catch (e) { console.error(e); }
  };

  const createCampaign = async () => {
      if (!newCampaign.name || selectedIds.size === 0) return alert('Selecione leads.');
      try {
          const res = await fetch('/api/campaigns', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...newCampaign, leads: Array.from(selectedIds) })
          });
          if (res.ok) {
              setIsCreatingCampaign(false);
              fetchCampaigns();
              fetchCompanies();
          }
      } catch (e) { alert('Erro'); }
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

  const toggleLeadAI = async (id: string, currentStatus: boolean | undefined) => {
      try {
          await fetch('/api/leads/toggle-ai', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ id, active: !currentStatus })
          });
          fetchCompanies();
      } catch(e) { console.error(e); }
  };

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const searchMatch = !filters.search || c.razaoSocial?.toLowerCase().includes(filters.search.toLowerCase()) || c.inscricaoEstadual?.includes(filters.search);
      const cityMatch = !filters.city || c.municipio === filters.city;
      const reasonMatch = !filters.reason || c.motivoSituacao === filters.reason;
      const accountantMatch = filters.hasAccountant === 'all' ? true : filters.hasAccountant === 'yes' ? !!c.nomeContador : !c.nomeContador;
      const waMatch = filters.statusWa === 'all' ? true : c.campaignStatus === filters.statusWa;
      return searchMatch && cityMatch && reasonMatch && accountantMatch && waMatch;
    });
  }, [companies, filters]);

  const activeChatCompany = useMemo(() => {
      if (!activeChat) return null;
      const cleanChatId = activeChat.replace(/\D/g, '');
      return companies.find(c => c.telefone?.replace(/\D/g, '').includes(cleanChatId) || cleanChatId.includes(c.telefone?.replace(/\D/g, '') || 'XXX'));
  }, [activeChat, companies]);

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-brand-950 text-white transition-all flex flex-col z-20`}>
        <div className="p-4 flex items-center justify-between border-b border-brand-800">
          <span className="font-bold text-lg">CRM VÍRGULA</span>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}><Menu size={18}/></button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'kanban', icon: Trello, label: 'Kanban Vendas' },
            { id: 'import', icon: Upload, label: 'Importar PDF' },
            { id: 'companies', icon: FileSpreadsheet, label: 'Base de Empresas' },
            { id: 'campaigns', icon: Rocket, label: 'Campanhas' },
            { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp' },
            { id: 'knowledge', icon: BookOpen, label: 'Conhecimento' },
            { id: 'settings', icon: Settings, label: 'Configurações' },
          ].map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl ${activeTab === item.id ? 'bg-brand-600' : 'hover:bg-brand-900'}`}>
              <item.icon size={20} />
              {isSidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-xl font-bold">{activeTab.toUpperCase()}</h1>
        </header>

        <div className="p-8">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-4 gap-6">
                <div className="card-premium p-6"><h3>Total Base</h3><p className="text-3xl font-bold">{stats.total}</p></div>
                <div className="card-premium p-6"><h3>Sucesso Scraper</h3><p className="text-3xl font-bold text-emerald-600">{stats.success}</p></div>
                <div className="card-premium p-6"><h3>Erros</h3><p className="text-3xl font-bold text-rose-600">{stats.errors}</p></div>
                <div className="card-premium p-6"><h3>Campanhas</h3><p className="text-3xl font-bold text-brand-600">{campaigns.length}</p></div>
            </div>
          )}

          {activeTab === 'companies' && (
            <>
              <FilterBar filters={filters} setFilters={setFilters} availableCities={availableCities} availableReasons={availableReasons} onRefresh={fetchCompanies} />
              <CompanyTable companies={filteredCompanies} selectedIds={selectedIds} toggleSelection={id => {
                  const n = new Set(selectedIds); if(n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n);
              }} toggleSelectAll={() => setSelectedIds(selectedIds.size === filteredCompanies.length ? new Set() : new Set(filteredCompanies.map(c => c.id)))} selectable={true} onToggleAi={toggleLeadAI} />
            </>
          )}

          {activeTab === 'kanban' && (
              <div className="flex gap-4 overflow-x-auto h-[70vh]">
                  <KanbanColumn title="Pendente" companies={filteredCompanies.filter(c => c.campaignStatus === 'pending')} onCardClick={setSelectedKanbanLead}/>
                  <KanbanColumn title="Enviado" companies={filteredCompanies.filter(c => c.campaignStatus === 'sent')} onCardClick={setSelectedKanbanLead}/>
                  <KanbanColumn title="Respondeu" companies={filteredCompanies.filter(c => c.campaignStatus === 'replied')} onCardClick={setSelectedKanbanLead}/>
                  <KanbanColumn title="Interessado" companies={filteredCompanies.filter(c => c.campaignStatus === 'interested')} onCardClick={setSelectedKanbanLead}/>
                  <SelectedLeadModal company={selectedKanbanLead} onClose={() => setSelectedKanbanLead(null)} onGoToChat={c => { setActiveTab('whatsapp'); setActiveChat(c.telefone+'@c.us'); setSelectedKanbanLead(null); }}/>
              </div>
          )}

          {activeTab === 'knowledge' && (
              <div className="max-w-4xl mx-auto space-y-6">
                  <div className="flex justify-between">
                      <h2 className="text-2xl font-bold">Base de Conhecimento</h2>
                      <button onClick={() => setEditingRule({ id: uuidv4(), motivoSituacao: '', instructions: [], isActive: true })} className="btn-primary">Nova Regra</button>
                  </div>
                  {editingRule ? (
                      <div className="card-premium p-6">
                          <div className="space-y-4">
                              <label className="block text-sm font-bold">Motivo (Conforme consta no banco):</label>
                              <select 
                                className="input-premium"
                                value={editingRule.motivoSituacao}
                                onChange={e => setEditingRule({...editingRule, motivoSituacao: e.target.value})}
                              >
                                  <option value="">Selecione um motivo...</option>
                                  {availableReasons.map((m, i) => <option key={i} value={m}>{m}</option>)}
                              </select>
                              <button onClick={() => setEditingRule({...editingRule, instructions: [...editingRule.instructions, { id: uuidv4(), content: '', type: 'simple', title: '' }]})} className="text-brand-600">+ Instrução</button>
                              {editingRule.instructions.map((inst, i) => (
                                  <input key={i} className="input-premium" value={inst.content} onChange={e => {
                                      const n = [...editingRule.instructions]; n[i].content = e.target.value; setEditingRule({...editingRule, instructions: n});
                                  }} />
                              ))}
                              <div className="flex justify-end gap-2">
                                  <button onClick={() => setEditingRule(null)} className="btn-secondary">Cancelar</button>
                                  <button onClick={() => {
                                      const n = aiConfig.knowledgeRules.filter(r => r.id !== editingRule.id); n.push(editingRule);
                                      saveAiConfig({...aiConfig, knowledgeRules: n}); setEditingRule(null);
                                  }} className="btn-primary">Salvar</button>
                              </div>
                          </div>
                      </div>
                  ) : (
                      aiConfig.knowledgeRules.map(r => (
                          <div key={r.id} className="card-premium p-4 flex justify-between">
                              <div><h4 className="font-bold">{r.motivoSituacao}</h4><p className="text-xs text-slate-500">{r.instructions.length} instruções</p></div>
                              <button onClick={() => setEditingRule(r)} className="p-2 text-slate-400 hover:text-brand-600"><Edit size={18}/></button>
                          </div>
                      ))
                  )}
              </div>
          )}

          {activeTab === 'whatsapp' && (
              <div className="flex h-[75vh] gap-4">
                  <div className="w-1/3 card-premium overflow-y-auto">
                      {chats.map(c => (
                          <div key={c.id} onClick={() => { setActiveChat(c.id); fetchMessages(c.id); }} className={`p-4 border-b cursor-pointer ${activeChat === c.id ? 'bg-slate-100' : ''}`}>
                              <h4 className="font-bold text-sm truncate">{c.name || c.id}</h4>
                              <p className="text-xs text-slate-500 truncate">{c.lastMessage}</p>
                          </div>
                      ))}
                  </div>
                  <div className="flex-1 card-premium flex flex-col bg-[#efeae2]">
                      <div className="p-3 border-b bg-white flex justify-between items-center">
                          <span className="font-bold">{activeChatCompany?.razaoSocial || activeChat}</span>
                          {activeChatCompany && <button onClick={() => toggleLeadAI(activeChatCompany.id, activeChatCompany.aiActive)} className={`p-2 rounded-full ${activeChatCompany.aiActive ? 'text-emerald-500 bg-emerald-50' : 'text-slate-400'}`}><Bot/></button>}
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-2">
                          {chatMessages.map(m => (
                              <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`p-2 rounded-lg text-sm max-w-[80%] ${m.fromMe ? 'bg-[#d9fdd3]' : 'bg-white'}`}>{m.body}</div>
                              </div>
                          ))}
                      </div>
                      <div className="p-3 bg-white flex gap-2">
                          <input className="flex-1 bg-slate-100 rounded-lg px-4 py-2" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} />
                          <button onClick={sendMessage} className="bg-emerald-600 text-white p-2 rounded-full"><Send/></button>
                      </div>
                  </div>
              </div>
          )}

          {activeTab === 'settings' && (
              <div className="max-w-2xl mx-auto space-y-6">
                  <div className="card-premium p-6 space-y-4">
                      <h3 className="font-bold">IA e Modelos</h3>
                      <ApiKeyInput label="Gemini Key" provider="gemini" currentKey={aiConfig.apiKeys?.gemini} activeProvider={aiConfig.provider} onChange={(p, v) => setAiConfig({...aiConfig, apiKeys: {...aiConfig.apiKeys, [p]: v}})} />
                      <ApiKeyInput label="Groq Key" provider="groq" currentKey={aiConfig.apiKeys?.groq} activeProvider={aiConfig.provider} onChange={(p, v) => setAiConfig({...aiConfig, apiKeys: {...aiConfig.apiKeys, [p]: v}})} />
                      <textarea className="input-premium h-32" value={aiConfig.persona} onChange={e => setAiConfig({...aiConfig, persona: e.target.value})} />
                      <button onClick={() => saveAiConfig(aiConfig)} className="btn-primary w-full">Salvar Configurações</button>
                  </div>
              </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;