
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Upload, MessageCircle, Bot, Settings, Menu, FileSpreadsheet, Search,
  CheckCircle2, AlertCircle, Send, RefreshCw, BookOpen, Plus, Trash2,
  Briefcase, MessageSquare, User, Paperclip, Mic, X, Save,
  BarChart3, Rocket, Sparkles, CheckSquare, Square, Trello, MoreHorizontal, PauseCircle, PlayCircle, Edit,
  ToggleLeft, ToggleRight, Power, Phone, MoreVertical, Smile, Paperclip as PaperclipIcon, Check, Eye, EyeOff, Cpu
} from 'lucide-react';
import { CompanyResult, Status, CampaignStatus, KnowledgeRule, AIConfig, WhatsAppSession, ImportBatch } from './types';
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

// --- EXTRACTED COMPONENTS ---

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
        <option value="queued">Fila de Envio</option>
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
                    title={company.aiActive ? "Desativar IA" : "Ativar IA"}
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
        </div>
    </div>
);

const KanbanColumn = ({ title, status, companies, onCardClick }: any) => {
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
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-slate-500 uppercase font-bold">Município</label>
                            <p className="text-sm font-medium">{company.municipio}</p>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 uppercase font-bold">Situação</label>
                            <p className="text-sm font-medium">{company.situacaoCadastral}</p>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 uppercase font-bold">Motivo da Inaptidão</label>
                        <div className="bg-rose-50 text-rose-800 p-3 rounded-lg text-sm border border-rose-100">
                            {cleanReasonText(company.motivoSituacao) || 'Não informado'}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                         <button onClick={onClose} className="btn-secondary">Fechar</button>
                         <button onClick={() => onGoToChat(company)} className="btn-primary" disabled={!company.telefone}>
                             <MessageCircle size={18} /> Ir para WhatsApp
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
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center justify-between">
                <span>{label}</span>
                {activeProvider === provider && <span className="text-xs font-bold text-brand-600 px-2 py-0.5 bg-white rounded-full border border-brand-100">ATIVO</span>}
            </label>
            <div className="relative">
                <input 
                    type={show ? "text" : "password"}
                    className="input-premium pr-10"
                    value={currentKey || ''}
                    onChange={(e) => onChange(provider, e.target.value)}
                    placeholder={`Cole sua API Key do ${label}...`}
                />
                <button onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Data States
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, processed: 0, success: 0, errors: 0 });

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
  const [selectedKanbanLead, setSelectedKanbanLead] = useState<CompanyResult | null>(null);

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
    model: 'gemini-3-flash-preview',
    provider: 'gemini',
    apiKeys: { gemini: '', groq: '' },
    persona: DEFAULT_AI_PERSONA,
    knowledgeRules: [],
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
  
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Initial Load
  useEffect(() => {
    fetchCompanies();
    fetchFilters();
    fetchCampaigns();
    fetchAiConfig();
  }, []);

  useInterval(() => {
    fetchWhatsAppStatus();
    if (activeTab === 'whatsapp' && waSession.status === 'connected') {
      fetchChats();
      if (activeChat) fetchMessages(activeChat);
    }
  }, 3000);

  const fetchAiConfig = async () => {
      try {
          const res = await fetch('/api/config');
          if (res.ok) {
              const data = await res.json();
              setAiConfig(data);
          }
      } catch (e) { console.error(e); }
  }

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
              alert('Configurações salvas com sucesso!');
          } else {
              alert('Erro ao salvar no servidor.');
          }
      } catch (e) { 
          console.error(e); 
          alert('Erro de conexão ao salvar configurações'); 
      } finally {
          setIsSavingConfig(false);
      }
  }

  const fetchFilters = async () => {
    try {
      const res = await fetch('/api/unique-filters');
      if (res.ok) {
        const data = await res.json();
        setAvailableCities((data.municipios as string[]) || []);
        
        if (data.motivos) {
             const cleanedReasons = new Set(data.motivos.map((m: any) => cleanReasonText(m)));
             setAvailableReasons((Array.from(cleanedReasons).filter((r) => !!r) as string[]).sort());
        } else {
             setAvailableReasons([]);
        }
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

  const toggleLeadAI = async (id: string, currentStatus: boolean | undefined) => {
      const newStatus = !currentStatus;
      try {
          await fetch('/api/leads/toggle-ai', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ id, active: newStatus })
          });
          setCompanies(prev => prev.map(c => c.id === id ? { ...c, aiActive: newStatus } : c));
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
      
      const cleanedLeadReason = cleanReasonText(c.motivoSituacao);
      const reasonMatch = !filters.reason || 
        (cleanedLeadReason && cleanedLeadReason.toLowerCase().includes(filters.reason.toLowerCase()));
        
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

  const goToChat = (company: CompanyResult) => {
      if(company.telefone) {
          const raw = company.telefone.replace(/\D/g, '');
          const target = raw.length < 12 ? '55' + raw : raw;
          const chatId = target + '@c.us';
          setActiveTab('whatsapp');
          setActiveChat(chatId);
          fetchMessages(chatId);
          setSelectedKanbanLead(null);
      } else {
          alert('Empresa sem telefone cadastrado.');
      }
  };

  const activeChatCompany = useMemo(() => {
      if (!activeChat || companies.length === 0) return null;
      const cleanChatId = activeChat.replace(/\D/g, '');
      return companies.find(c => {
          if (!c.telefone) return false;
          const cleanCompanyPhone = c.telefone.replace(/\D/g, '');
          return cleanChatId.includes(cleanCompanyPhone) || cleanCompanyPhone.includes(cleanChatId);
      });
  }, [activeChat, companies]);

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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-slate-50 relative">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">
            {activeTab === 'dashboard' && 'Visão Geral'}
            {activeTab === 'kanban' && 'Gestão de Atendimentos'}
            {activeTab === 'companies' && 'Base de Empresas'}
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
                selectable={true}
                onToggleAi={toggleLeadAI}
              />
            </div>
          )}

          {activeTab === 'kanban' && (
              <div className="h-full">
                  <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-140px)]">
                      <KanbanColumn 
                        title="Envio Pendente" 
                        status="pending" 
                        companies={filteredCompanies.filter(c => c.campaignStatus === 'pending' || c.campaignStatus === 'queued' || !c.campaignStatus)} 
                        onCardClick={setSelectedKanbanLead}
                      />
                      <KanbanColumn 
                        title="Enviados" 
                        status="sent" 
                        companies={filteredCompanies.filter(c => c.campaignStatus === 'sent' || c.campaignStatus === 'delivered')} 
                        onCardClick={setSelectedKanbanLead}
                      />
                      <KanbanColumn 
                        title="Responderam" 
                        status="replied" 
                        companies={filteredCompanies.filter(c => c.campaignStatus === 'replied')} 
                        onCardClick={setSelectedKanbanLead}
                      />
                      <KanbanColumn 
                        title="Interessados" 
                        status="interested" 
                        companies={filteredCompanies.filter(c => c.campaignStatus === 'interested')} 
                        onCardClick={setSelectedKanbanLead}
                      />
                  </div>
                  <SelectedLeadModal 
                    company={selectedKanbanLead} 
                    onClose={() => setSelectedKanbanLead(null)} 
                    onGoToChat={goToChat}
                  />
              </div>
          )}

          {/* WhatsApp Tab */}
          {activeTab === 'whatsapp' && (
            <div className="flex h-full gap-6">
              <div className="w-1/3 card-premium flex flex-col overflow-hidden bg-white">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                       <h3 className="font-bold text-slate-700">Conversas</h3>
                   </div>
                   <div className={`w-3 h-3 rounded-full ${waSession.status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {chats.map(chat => (
                        <div key={chat.id} onClick={() => { setActiveChat(chat.id); fetchMessages(chat.id); }} className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors flex gap-3 ${activeChat === chat.id ? 'bg-slate-100' : ''}`}>
                            <div className="w-12 h-12 rounded-full bg-brand-100 flex-shrink-0 flex items-center justify-center text-brand-600 font-bold">
                                {getInitials(chat.name || 'U')}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-slate-800 text-sm truncate">{chat.name || chat.id.split('@')[0]}</h4>
                                <p className="text-xs text-slate-500 truncate">{chat.lastMessage}</p>
                            </div>
                        </div>
                    ))}
                </div>
              </div>

              <div className="flex-1 card-premium flex flex-col overflow-hidden bg-[#efeae2] relative">
                {activeChat ? (
                  <>
                     <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-white/95 backdrop-blur-sm z-10">
                        <div className="flex items-center gap-3">
                            <h3 className="font-bold text-slate-800 text-sm">
                                {chats.find(c => c.id === activeChat)?.name || activeChat.replace('@c.us', '')}
                            </h3>
                        </div>
                        {activeChatCompany && (
                            <button onClick={() => toggleLeadAI(activeChatCompany.id, activeChatCompany.aiActive)} className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${activeChatCompany.aiActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                                {activeChatCompany.aiActive ? "IA Auto" : "IA Off"}
                            </button>
                        )}
                     </div>

                     <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {chatMessages.map(msg => (
                           <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`relative max-w-[75%] px-3 py-2 text-sm shadow-sm rounded-lg ${msg.fromMe ? 'bg-[#d9fdd3] text-slate-900' : 'bg-white text-slate-900'}`}>
                                 <p className="whitespace-pre-wrap">{msg.body}</p>
                                 <span className="text-[10px] text-slate-400 block text-right mt-1">{formatTime(msg.timestamp)}</span>
                              </div>
                           </div>
                        ))}
                     </div>

                     <div className="p-3 bg-[#f0f2f5] border-t border-slate-200 flex items-end gap-2">
                        <input type="text" className="flex-1 bg-white rounded-xl border border-white px-4 py-2 outline-none" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Digite uma mensagem..." />
                        <button onClick={sendMessage} className="p-3 bg-emerald-600 text-white rounded-full"><Send size={20} /></button>
                     </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                      <h2 className="text-2xl font-light text-slate-600">Selecione uma conversa</h2>
                  </div>
                )}
              </div>
            </div>
          )}

           {activeTab === 'knowledge' && (
              <div className="max-w-4xl mx-auto space-y-6">
                 <div className="flex justify-between items-center">
                     <div>
                        <h2 className="text-2xl font-bold text-slate-800">Base de Conhecimento</h2>
                        <p className="text-slate-500">Regras vinculadas aos motivos reais do banco de dados</p>
                     </div>
                     <button onClick={() => setEditingRule({ id: uuidv4(), motivoSituacao: '', instructions: [], isActive: true })} className="btn-primary">
                         <Plus size={18} /> Nova Regra
                     </button>
                 </div>

                 {editingRule ? (
                     <div className="card-premium p-8 animate-fade-in shadow-xl border-brand-100">
                         <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-800">Editor de Regra</h3>
                            <span className="text-xs bg-brand-50 text-brand-600 px-3 py-1 rounded-full font-bold">Instrução Contextual</span>
                         </div>
                         <div className="space-y-6">
                             <div>
                                 <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Motivo SEFAZ (Banco de Dados)</label>
                                 <div className="relative">
                                     <input 
                                        list="reasons-list"
                                        className="input-premium border-brand-200 focus:border-brand-500" 
                                        placeholder="Selecione o motivo exato..."
                                        value={editingRule.motivoSituacao}
                                        onChange={e => setEditingRule({...editingRule, motivoSituacao: e.target.value})}
                                     />
                                     <datalist id="reasons-list">
                                        {availableReasons.map((r: string, idx: number) => (
                                            <option key={idx} value={r} />
                                        ))}
                                     </datalist>
                                 </div>
                                 <p className="text-xs text-slate-400 mt-2">Dica: Use a lista suspensa para garantir que a IA identifique o lead corretamente.</p>
                             </div>
                             
                             <div>
                                 <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Diretrizes para a IA</label>
                                 <div className="space-y-3">
                                     {editingRule.instructions.map((inst, idx) => (
                                         <div key={idx} className="flex gap-3 group">
                                             <div className="flex-1">
                                                 <input 
                                                    className="input-premium focus:ring-brand-500/20" 
                                                    value={inst.content} 
                                                    onChange={e => {
                                                        const newInsts = [...editingRule.instructions];
                                                        newInsts[idx].content = e.target.value;
                                                        setEditingRule({...editingRule, instructions: newInsts});
                                                    }}
                                                    placeholder="Ex: Explicar que o MEI excedeu o limite..."
                                                 />
                                             </div>
                                             <button onClick={() => {
                                                 const newInsts = editingRule.instructions.filter((_, i) => i !== idx);
                                                 setEditingRule({...editingRule, instructions: newInsts});
                                             }} className="p-3 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                                         </div>
                                     ))}
                                 </div>
                                 <button onClick={() => {
                                     setEditingRule({
                                         ...editingRule, 
                                         instructions: [...editingRule.instructions, { id: uuidv4(), title: 'Info', type: 'simple', content: '' }]
                                     });
                                 }} className="mt-4 flex items-center gap-2 text-brand-600 text-sm font-bold hover:text-brand-700 transition-colors">
                                     <Plus size={16} /> Adicionar Nova Diretriz
                                 </button>
                             </div>

                             <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                                 <button onClick={() => setEditingRule(null)} className="btn-secondary">Cancelar</button>
                                 <button onClick={() => {
                                     if(!editingRule.motivoSituacao) return alert("Selecione um motivo");
                                     const newRules = aiConfig.knowledgeRules.filter(r => r.id !== editingRule.id);
                                     newRules.push(editingRule);
                                     saveAiConfig({...aiConfig, knowledgeRules: newRules});
                                     setEditingRule(null);
                                 }} className="btn-primary px-8">Salvar Regra de Inteligência</button>
                             </div>
                         </div>
                     </div>
                 ) : (
                     <div className="grid gap-4">
                         {aiConfig.knowledgeRules.map(rule => (
                             <div key={rule.id} className="card-premium p-6 flex justify-between items-start border-l-4 border-l-brand-500 hover:shadow-lg transition-shadow">
                                 <div>
                                     <h4 className="font-bold text-lg text-slate-800 flex items-center gap-2 mb-3">
                                         <BookOpen size={18} className="text-brand-500"/>
                                         {rule.motivoSituacao}
                                     </h4>
                                     <div className="space-y-2">
                                         {rule.instructions.map((inst, i) => (
                                             <div key={i} className="flex gap-2 items-start text-sm text-slate-600">
                                                 <CheckCircle2 size={14} className="mt-0.5 text-emerald-500 shrink-0" />
                                                 <p>{inst.content}</p>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                                 <div className="flex gap-1">
                                     <button onClick={() => setEditingRule(rule)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"><Edit size={18}/></button>
                                     <button onClick={() => {
                                         if(confirm("Excluir regra?")) {
                                             const newRules = aiConfig.knowledgeRules.filter(r => r.id !== rule.id);
                                             saveAiConfig({...aiConfig, knowledgeRules: newRules});
                                         }
                                     }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 size={18}/></button>
                                 </div>
                             </div>
                         ))}
                     </div>
                 )}
              </div>
           )}

           {activeTab === 'settings' && (
               <div className="max-w-3xl mx-auto space-y-6">
                   <div className="card-premium p-8">
                       <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Bot size={20}/> Configurações de IA</h3>
                       <div className="space-y-4">
                           <div>
                               <label className="block text-sm font-medium text-slate-700 mb-1">Persona Global (Base)</label>
                               <textarea 
                                  className="input-premium h-32"
                                  value={aiConfig.persona}
                                  onChange={e => setAiConfig({...aiConfig, persona: e.target.value})}
                               />
                               <p className="text-xs text-slate-400 mt-2">Esta persona será usada como base antes das regras específicas da Base de Conhecimento.</p>
                           </div>
                           <button onClick={() => saveAiConfig(aiConfig)} className="btn-primary w-full mt-4"><Save size={18}/> Salvar Preferências</button>
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
