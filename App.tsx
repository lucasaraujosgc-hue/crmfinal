
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Upload, MessageCircle, Bot, Settings, Menu, FileSpreadsheet, Search,
  CheckCircle2, AlertCircle, Send, RefreshCw, BookOpen, Plus, Trash2,
  User, X, Save, Rocket, Trello, Edit, Power, Phone,
  MoreVertical, Smile, Paperclip as PaperclipIcon, Check, Eye, EyeOff, Cpu, Terminal,
  ChevronRight, Globe, ShieldCheck, Zap, Activity, BarChart3, PieChart as PieChartIcon,
  Database, Filter, ArrowLeft, ArrowRight, Play, Clock
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, AreaChart, Area
} from 'recharts';
import { CompanyResult, Status, CampaignStatus, KnowledgeRule, AIConfig, WhatsAppSession, ImportBatch, Instruction } from './types';
import { DEFAULT_KNOWLEDGE_RULES, DEFAULT_AI_PERSONA } from './constants';
import { v4 as uuidv4 } from 'uuid';

// --- Custom Hooks ---

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
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
    } catch (error) {}
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

// --- Helpers ---

const cleanReasonText = (text: string | null | undefined) => {
    if (!text) return '';
    return text.split('Endereço de Correspondência')[0]
               .split('Endereço:')[0]
               .split('Endereco de Correspondencia')[0]
               .trim();
};

const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getInitials = (name: string) => {
    return name?.split(' ').filter(n => !!n).map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??';
};

// --- Subcomponentes Visuais ---

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: string }) => {
  const styles: Record<string, string> = {
    default: 'bg-slate-100 text-slate-600 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/50',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/50',
    brand: 'bg-brand-50 text-brand-700 border-brand-200/50',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${styles[variant] || styles.default} backdrop-blur-sm`}>
      {children}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, string> = {
        'pending': 'bg-slate-100 text-slate-600 border-slate-200/50',
        'queued': 'bg-amber-50 text-amber-700 border-amber-200/50',
        'sent': 'bg-blue-50 text-blue-700 border-blue-200/50',
        'replied': 'bg-purple-50 text-purple-700 border-purple-200/50',
        'interested': 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
        'not_interested': 'bg-rose-50 text-rose-700 border-rose-200/50',
        'error': 'bg-rose-100 text-rose-700 border-rose-200/50',
        'skipped': 'bg-slate-200 text-slate-500 border-slate-300/50'
    };
    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${map[status] || map['pending']}`}>
            {status}
        </span>
    );
};

// --- Componentes Funcionais Reutilizáveis ---

// Barra de Filtros (Extraída para reuso no Wizard e na Aba Leads)
const FilterBar = ({ filters, setFilters, availableCities, availableReasons, onRefresh, totalResults }: any) => (
    <div className="card-premium p-6 flex flex-col xl:flex-row gap-6 items-center justify-between bg-white border-none shadow-xl rounded-[32px] mb-8">
        <div className="flex-1 relative group w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={20} />
            <input 
                type="text" 
                className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-[20px] text-sm font-bold focus:ring-[4px] focus:ring-brand-500/10 transition-all placeholder:text-slate-300 shadow-inner"
                placeholder="Filtrar por Razão Social, CNPJ..."
                value={filters.search}
                onChange={e => setFilters({...filters, search: e.target.value})}
            />
        </div>
        <div className="flex items-center gap-3 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 custom-scrollbar">
            <select className="bg-slate-50 border-none rounded-[20px] px-6 py-4 text-[11px] font-black uppercase text-slate-600 focus:ring-4 focus:ring-brand-500/10 cursor-pointer shadow-sm min-w-[150px]"
                value={filters.city} onChange={e => setFilters({...filters, city: e.target.value})}>
                <option value="">Todas Cidades</option>
                {availableCities.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
            
            <select className="bg-slate-50 border-none rounded-[20px] px-6 py-4 text-[11px] font-black uppercase text-slate-600 focus:ring-4 focus:ring-brand-500/10 cursor-pointer shadow-sm min-w-[150px]"
                value={filters.reason} onChange={e => setFilters({...filters, reason: e.target.value})}>
                <option value="">Todos Motivos</option>
                {availableReasons.map((r: string) => <option key={r} value={r}>{r}</option>)}
            </select>

            <select className="bg-slate-50 border-none rounded-[20px] px-6 py-4 text-[11px] font-black uppercase text-slate-600 focus:ring-4 focus:ring-brand-500/10 cursor-pointer shadow-sm min-w-[150px]"
                value={filters.statusWa} onChange={e => setFilters({...filters, statusWa: e.target.value})}>
                <option value="all">Status Zap</option>
                <option value="pending">Pendente</option>
                <option value="sent">Enviado</option>
                <option value="replied">Respondido</option>
                <option value="interested">Quente</option>
            </select>
            
            {onRefresh && (
                <button onClick={onRefresh} className="p-4 bg-slate-100 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-[20px] transition-all">
                    <RefreshCw size={20} />
                </button>
            )}
        </div>
        {totalResults !== undefined && (
             <div className="px-6 py-4 bg-slate-100 rounded-[20px] font-black text-slate-500 text-xs whitespace-nowrap">
                 {totalResults} LEADS
             </div>
        )}
    </div>
);

// Tabela de Empresas (Extraída para reuso)
const CompanyTable = ({ companies, selectedIds, toggleSelection, toggleSelectAll, selectable = false, onToggleAi, onChat }: any) => (
    <div className="card-premium overflow-hidden border-none shadow-2xl rounded-[32px] bg-white">
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100/50">
                        {selectable && (
                            <th className="px-6 py-6 w-16 text-center">
                                <button onClick={toggleSelectAll} className={`p-2 rounded-lg transition-colors ${selectedIds.size > 0 && selectedIds.size === companies.length ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                    <Check size={16} strokeWidth={3} />
                                </button>
                            </th>
                        )}
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Empresa / Fiscal</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                        <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Motivo SEFAZ</th>
                        {onToggleAi && <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">IA Auto</th>}
                        {onChat && <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ação</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {companies.slice(0, 100).map((lead: CompanyResult) => (
                        <tr key={lead.id} className={`group transition-all duration-300 ${selectedIds?.has(lead.id) ? 'bg-brand-50/40' : 'hover:bg-slate-50/50'}`}>
                            {selectable && (
                                <td className="px-6 py-6 text-center">
                                    <button onClick={() => toggleSelection(lead.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedIds.has(lead.id) ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-300 text-transparent hover:border-brand-300'}`}>
                                        <Check size={12} strokeWidth={4} />
                                    </button>
                                </td>
                            )}
                            <td className="px-8 py-6">
                                <div className="flex items-center gap-5">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs shadow-sm border border-slate-200/50">
                                        {getInitials(lead.razaoSocial)}
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-800 text-xs uppercase tracking-tight truncate max-w-[220px]">{lead.razaoSocial}</p>
                                        <div className="flex gap-2 mt-1">
                                            <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-1.5 rounded">{lead.cnpj}</span>
                                            <span className="text-[9px] font-bold text-slate-400">{lead.municipio}</span>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-8 py-6">
                                <div className="flex flex-col gap-1.5 items-start">
                                    <Badge variant={lead.situacaoCadastral?.includes('ATIVA') ? 'success' : 'danger'}>{lead.situacaoCadastral}</Badge>
                                    <StatusBadge status={lead.campaignStatus} />
                                </div>
                            </td>
                            <td className="px-8 py-6 max-w-[280px]">
                                <p className="text-[10px] text-slate-500 font-medium italic leading-relaxed line-clamp-2" title={lead.motivoSituacao}>
                                    "{cleanReasonText(lead.motivoSituacao)}"
                                </p>
                            </td>
                            {onToggleAi && (
                                <td className="px-8 py-6 text-center">
                                    <button onClick={() => onToggleAi(lead.id, lead.aiActive)} className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 focus:outline-none ${lead.aiActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${lead.aiActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </td>
                            )}
                            {onChat && (
                                <td className="px-8 py-6 text-right">
                                    <button onClick={() => onChat(lead)} className="p-3 bg-white text-brand-600 border border-brand-100 rounded-xl hover:bg-brand-600 hover:text-white transition-all shadow-sm active:scale-90">
                                        <MessageCircle size={18} strokeWidth={2.5} />
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
);

// Card Kanban (Extraído)
const KanbanCard = ({ company, onClick }: { company: CompanyResult, onClick: () => void }) => (
    <div onClick={onClick} className="bg-white p-6 rounded-[24px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer border border-slate-100 group relative overflow-hidden mb-4">
        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-slate-50 to-slate-100 rounded-bl-[32px] -mr-4 -mt-4 transition-all group-hover:scale-150"></div>
        
        <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-slate-400 text-xs border border-slate-100">
                {getInitials(company.razaoSocial)}
            </div>
            {company.aiActive && (
                <div className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1 border border-emerald-100">
                    <Bot size={10} /> Auto
                </div>
            )}
        </div>
        
        <h4 className="font-bold text-slate-800 text-sm leading-tight mb-2 line-clamp-2 relative z-10 group-hover:text-brand-600 transition-colors">
            {company.razaoSocial}
        </h4>
        
        <div className="flex items-center gap-2 mb-4 relative z-10">
            <Badge variant={company.situacaoCadastral?.includes('ATIVA') ? 'success' : 'danger'}>{company.situacaoCadastral}</Badge>
            <span className="text-[10px] font-mono text-slate-400">{company.municipio}</span>
        </div>

        {company.lastContacted && (
             <div className="pt-4 border-t border-slate-50 flex items-center gap-2 text-slate-400 relative z-10">
                 <Clock size={12} />
                 <span className="text-[10px] font-bold uppercase tracking-wide">
                     {new Date(company.lastContacted).toLocaleDateString()}
                 </span>
             </div>
        )}
    </div>
);

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
    statusWa: 'all',
    hasPhone: 'all'
  });
  
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableReasons, setAvailableReasons] = useState<string[]>([]);

  // Selection & UI Helpers
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Campaign Wizard State
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaignStep, setCampaignStep] = useState(1);
  const [newCampaign, setNewCampaign] = useState({
     name: '',
     description: '',
     initialMessage: 'Olá, tudo bem? Vi que sua empresa possui pendências na SEFAZ e gostaria de ajudar na regularização.',
     aiPersona: DEFAULT_AI_PERSONA
  });

  // AI & Knowledge
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
    fetchImports();
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

  // --- API Calls ---

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

  const fetchFilters = async () => {
    try {
      const res = await fetch('/api/unique-filters');
      if (res.ok) {
        const data = await res.json();
        setAvailableCities(data.municipios || []);
        if (data.motivos) {
             const cleaned = new Set(data.motivos.map((m: any) => cleanReasonText(m)));
             setAvailableReasons(Array.from(cleaned).filter(Boolean).sort() as string[]);
        }
      }
    } catch (e) {}
  };

  const fetchAiConfig = async () => {
    try {
      const res = await fetch('/api/config');
      if (res.ok) setAiConfig(await res.json());
    } catch (e) {}
  };

  const fetchWhatsAppStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) {
        const data = await res.json();
        setWaSession({ status: data.status, qrCode: data.qr });
      }
    } catch (e) {}
  };

  const fetchChats = async () => {
    try {
      const res = await fetch('/api/whatsapp/chats');
      if (res.ok) setChats(await res.json());
    } catch (e) {}
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/whatsapp/messages/${chatId}`);
      if (res.ok) setChatMessages(await res.json());
    } catch (e) {}
  };

  const fetchImports = async () => {
    try {
      const res = await fetch('/get-imports');
      if (res.ok) setImports(await res.json());
    } catch (e) {}
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      if (res.ok) setCampaigns(await res.json());
    } catch (e) {}
  };

  // --- Ações Funcionais ---

  const handleSendMessage = async () => {
    if (!activeChat || !newMessage.trim()) return;
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: activeChat, message: newMessage })
      });
      if (res.ok) {
        setNewMessage('');
        fetchMessages(activeChat);
      }
    } catch (e) {}
  };

  const toggleLeadAI = async (id: string, currentStatus: boolean | undefined) => {
    try {
      await fetch('/api/leads/toggle-ai', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ id, active: !currentStatus })
      });
      setCompanies(prev => prev.map(c => c.id === id ? { ...c, aiActive: !currentStatus } : c));
    } catch(e) {}
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
        setAiConfig(newConfig);
        alert('Configurações salvas!');
      }
    } catch (e) {
      alert('Erro de conexão');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const deleteImport = async (id: string) => {
    if(!confirm('Deseja apagar este lote de importação?')) return;
    try {
      await fetch(`/api/imports/${id}`, { method: 'DELETE' });
      fetchImports();
      fetchCompanies();
    } catch(e) {}
  };

  const createCampaign = async () => {
    if (!newCampaign.name || selectedIds.size === 0) return alert('Selecione leads e dê um nome.');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newCampaign, leads: Array.from(selectedIds) })
      });
      if (res.ok) {
        alert('Campanha disparada! O sistema processará os envios em background.');
        setIsCreatingCampaign(false);
        fetchCampaigns();
        fetchCompanies();
        setCampaignStep(1);
        setSelectedIds(new Set());
      }
    } catch (e) {}
  };

  // --- Lógica de Filtros e Seleção ---

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const searchMatch = !filters.search || 
        c.razaoSocial?.toLowerCase().includes(filters.search.toLowerCase()) ||
        c.cnpj?.includes(filters.search);
      const cityMatch = !filters.city || c.municipio === filters.city;
      const reasonMatch = !filters.reason || (c.motivoSituacao && c.motivoSituacao.toLowerCase().includes(filters.reason.toLowerCase()));
      const waMatch = filters.statusWa === 'all' ? true : c.campaignStatus === filters.statusWa;
      const phoneMatch = filters.hasPhone === 'all' ? true : (filters.hasPhone === 'yes' ? !!c.telefone : !c.telefone);
      return searchMatch && cityMatch && reasonMatch && waMatch && phoneMatch;
    });
  }, [companies, filters]);

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

  // --- Renderização ---

  const activeChatCompany = useMemo(() => {
      if (!activeChat) return null;
      const cleanChatId = activeChat.replace(/\D/g, '');
      return companies.find(c => c.telefone?.replace(/\D/g, '').includes(cleanChatId) || cleanChatId.includes(c.telefone?.replace(/\D/g, '') || 'XXX'));
  }, [activeChat, companies]);

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans selection:bg-brand-100 selection:text-brand-900">
      
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-24'} bg-[#0f172a] text-white transition-all duration-500 ease-in-out flex flex-col z-30 shadow-[4px_0_24px_rgba(0,0,0,0.15)] relative`}>
        <div className="p-8 border-b border-white/5 flex items-center justify-between overflow-hidden">
          {isSidebarOpen ? (
            <div className="flex items-center gap-4 animate-fade-in">
              <div className="w-11 h-11 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center shadow-[0_8px_16px_rgba(59,130,246,0.3)] ring-1 ring-white/20">
                <Rocket className="text-white" size={24} />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-xl tracking-tight leading-none">VIRGULA</h2>
                <p className="text-[9px] text-brand-400 font-black uppercase tracking-[0.25em] mt-1.5 opacity-80">Intelligence CRM</p>
              </div>
            </div>
          ) : (
            <div className="w-12 h-12 bg-brand-600/10 rounded-2xl flex items-center justify-center border border-brand-500/20 mx-auto">
                <Rocket className="text-brand-500" size={24} />
            </div>
          )}
        </div>

        <nav className="flex-1 p-4 mt-6 space-y-2 overflow-y-auto custom-scrollbar">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'kanban', icon: Trello, label: 'Kanban' },
            { id: 'import', icon: Upload, label: 'Importar PDF' },
            { id: 'campaigns', icon: Rocket, label: 'Campanhas' },
            { id: 'leads', icon: FileSpreadsheet, label: 'Base de Leads' },
            { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', badge: waSession.status === 'connected' ? 'On' : 'Off' },
            { id: 'knowledge', icon: BookOpen, label: 'Base de IA' },
            { id: 'settings', icon: Settings, label: 'Configurações' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full group flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 relative ${
                activeTab === item.id ? 'bg-brand-600 text-white shadow-xl scale-[1.02]' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={22} />
              {isSidebarOpen && <span className="font-bold text-sm truncate">{item.label}</span>}
              {activeTab === item.id && <div className="absolute right-0 w-1 h-6 bg-white rounded-l-full shadow-[0_0_12px_white]"></div>}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5 bg-black/20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Bot size={20} className={aiConfig.aiActive ? "text-emerald-400 shadow-[0_0_10px_#10b981]" : "text-slate-500"} />
                    {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-widest">IA Geral</span>}
                </div>
                <button onClick={() => saveAiConfig({...aiConfig, aiActive: !aiConfig.aiActive})} className={`w-10 h-5 rounded-full p-1 transition-all ${aiConfig.aiActive ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full transition-all ${aiConfig.aiActive ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="h-20 bg-white/70 backdrop-blur-2xl border-b border-slate-200/60 px-10 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-8">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-500 transition-all active:scale-90">
              <Menu size={22} />
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">{activeTab}</h1>
          </div>

          <div className="flex items-center gap-5">
             <button onClick={fetchCompanies} className="p-3.5 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-brand-600 transition-all group">
                <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-700" />
             </button>
             <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border shadow-sm ${waSession.status === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                <div className={`w-2 h-2 rounded-full ${waSession.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                <span className="text-[10px] font-black uppercase tracking-widest">Zap: {waSession.status.toUpperCase()}</span>
             </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-10 bg-slate-50/40 custom-scrollbar">
          
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-fade-in max-w-[1600px] mx-auto pb-20">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { label: 'Total Base', value: stats.total, icon: FileSpreadsheet, color: 'text-brand-600', bg: 'bg-brand-50' },
                  { label: 'Sucesso Extração', value: stats.success, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Erros SEFAZ', value: stats.errors, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Campanhas', value: campaigns.length, icon: Rocket, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map((stat, i) => (
                  <div key={i} className="card-premium p-8 group card-hover border-none relative overflow-hidden">
                    <div className={`absolute top-0 right-0 p-8 ${stat.color} opacity-[0.03] group-hover:scale-125 transition-transform duration-700`}><stat.icon size={120} /></div>
                    <div className="flex items-center justify-between mb-6 relative z-10">
                        <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300 shadow-sm`}><stat.icon size={26} strokeWidth={2.5} /></div>
                    </div>
                    <h3 className="text-4xl font-black text-slate-900 tracking-tight mb-2 relative z-10">{stat.value}</h3>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] relative z-10">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CAMPAIGNS - WIZARD RESTORED */}
          {activeTab === 'campaigns' && (
             <div className="max-w-[1600px] mx-auto animate-fade-in pb-32">
                 {!isCreatingCampaign ? (
                     <div className="space-y-10">
                         <div className="flex justify-between items-center bg-white p-10 rounded-[40px] shadow-lg border border-slate-50">
                             <div>
                                 <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Gestão de Campanhas</h2>
                                 <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Automação de Disparos em Massa com IA</p>
                             </div>
                             <button onClick={() => { setIsCreatingCampaign(true); setCampaignStep(1); }} className="btn-primary py-4 px-8 rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl shadow-brand-500/30">
                                 <Plus size={20} strokeWidth={3} /> Nova Campanha
                             </button>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                             {campaigns.map(c => (
                                 <div key={c.id} className="card-premium p-8 group relative hover:border-brand-300 transition-all">
                                     <div className="flex justify-between items-start mb-6">
                                         <div className="p-4 bg-brand-50 text-brand-600 rounded-2xl shadow-sm"><Rocket size={24} /></div>
                                         <Badge variant="success">Ativa</Badge>
                                     </div>
                                     <h3 className="font-black text-xl text-slate-800 mb-2 truncate">{c.name}</h3>
                                     <p className="text-xs text-slate-400 line-clamp-2 mb-6 font-medium">{c.description || 'Sem descrição definida.'}</p>
                                     <div className="grid grid-cols-3 gap-2 pt-6 border-t border-slate-50">
                                         <div className="text-center">
                                             <p className="text-[10px] font-black text-slate-300 uppercase">Total</p>
                                             <p className="font-bold text-slate-700">{c.stats?.total || 0}</p>
                                         </div>
                                         <div className="text-center border-l border-slate-50">
                                             <p className="text-[10px] font-black text-slate-300 uppercase">Enviados</p>
                                             <p className="font-bold text-brand-600">{c.stats?.sent || 0}</p>
                                         </div>
                                         <div className="text-center border-l border-slate-50">
                                             <p className="text-[10px] font-black text-slate-300 uppercase">Respostas</p>
                                             <p className="font-bold text-emerald-600">{c.stats?.replied || 0}</p>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                             {campaigns.length === 0 && (
                                 <div className="col-span-full p-20 text-center border-2 border-dashed border-slate-200 rounded-[40px]">
                                     <Rocket size={48} className="mx-auto text-slate-300 mb-4" />
                                     <p className="font-black text-slate-300 uppercase tracking-widest text-sm">Nenhuma campanha ativa</p>
                                 </div>
                             )}
                         </div>
                     </div>
                 ) : (
                     <div className="max-w-6xl mx-auto bg-white rounded-[48px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col min-h-[800px]">
                         {/* Wizard Header */}
                         <div className="bg-slate-50/80 p-10 border-b border-slate-100 flex items-center justify-between">
                             <div>
                                 <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Setup de Campanha</h2>
                                 <div className="flex items-center gap-2 mt-2">
                                     <span className={`h-2 w-2 rounded-full ${campaignStep >= 1 ? 'bg-brand-500' : 'bg-slate-300'}`}></span>
                                     <span className={`h-2 w-8 rounded-full ${campaignStep >= 2 ? 'bg-brand-500' : 'bg-slate-300'}`}></span>
                                     <span className={`h-2 w-2 rounded-full ${campaignStep >= 3 ? 'bg-brand-500' : 'bg-slate-300'}`}></span>
                                     <span className="ml-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">Passo {campaignStep} de 3</span>
                                 </div>
                             </div>
                             <button onClick={() => setIsCreatingCampaign(false)} className="p-3 hover:bg-white hover:text-rose-500 rounded-2xl transition-all shadow-sm"><X size={24}/></button>
                         </div>

                         {/* Wizard Body */}
                         <div className="flex-1 p-12 overflow-y-auto custom-scrollbar">
                             {campaignStep === 1 && (
                                 <div className="max-w-2xl mx-auto space-y-8 animate-slide-up">
                                     <div className="text-center mb-10">
                                         <div className="w-20 h-20 bg-brand-50 text-brand-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm"><FileSpreadsheet size={32} /></div>
                                         <h3 className="text-xl font-black text-slate-800">Definições Iniciais</h3>
                                         <p className="text-slate-400 text-sm font-medium mt-2">Dê um nome para identificar este lote de disparos.</p>
                                     </div>
                                     <div className="space-y-6">
                                         <div>
                                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Nome da Campanha</label>
                                             <input className="input-premium font-bold text-lg" placeholder="Ex: Lote Inaptidão 2024 - BA" value={newCampaign.name} onChange={e => setNewCampaign({...newCampaign, name: e.target.value})} autoFocus />
                                         </div>
                                         <div>
                                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Descrição (Opcional)</label>
                                             <textarea className="input-premium h-32 resize-none" placeholder="Detalhes sobre o público alvo..." value={newCampaign.description} onChange={e => setNewCampaign({...newCampaign, description: e.target.value})} />
                                         </div>
                                     </div>
                                 </div>
                             )}

                             {campaignStep === 2 && (
                                 <div className="space-y-6 animate-slide-up h-full flex flex-col">
                                     <div className="flex items-center justify-between mb-4">
                                         <h3 className="text-xl font-black text-slate-800">Seleção de Leads</h3>
                                         <div className="flex items-center gap-3">
                                             <Badge variant="brand">{selectedIds.size} Selecionados</Badge>
                                             {selectedIds.size > 0 && <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-rose-500 hover:underline">Limpar</button>}
                                         </div>
                                     </div>
                                     
                                     {/* Reutilizando FilterBar e CompanyTable */}
                                     <FilterBar filters={filters} setFilters={setFilters} availableCities={availableCities} availableReasons={availableReasons} totalResults={filteredCompanies.length} />
                                     
                                     <div className="flex-1 border border-slate-100 rounded-[32px] overflow-hidden">
                                         <div className="h-[450px] overflow-y-auto custom-scrollbar bg-slate-50/30">
                                            <CompanyTable 
                                                companies={filteredCompanies} 
                                                selectedIds={selectedIds} 
                                                toggleSelection={toggleSelection} 
                                                toggleSelectAll={toggleSelectAll} 
                                                selectable={true} 
                                            />
                                         </div>
                                     </div>
                                 </div>
                             )}

                             {campaignStep === 3 && (
                                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-slide-up h-full">
                                     <div className="space-y-6">
                                         <div className="flex items-center gap-4 mb-2">
                                             <div className="p-3 bg-brand-50 text-brand-600 rounded-xl"><MessageCircle size={24} /></div>
                                             <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Mensagem Inicial</h3>
                                         </div>
                                         <p className="text-xs text-slate-400 font-medium leading-relaxed">Esta mensagem será enviada para iniciar a conversa. Depois disso, a IA assume conforme a Persona.</p>
                                         <textarea className="input-premium h-64 font-medium text-sm leading-relaxed p-6" value={newCampaign.initialMessage} onChange={e => setNewCampaign({...newCampaign, initialMessage: e.target.value})} />
                                     </div>
                                     <div className="space-y-6">
                                         <div className="flex items-center gap-4 mb-2">
                                             <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Bot size={24} /></div>
                                             <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Persona Específica</h3>
                                         </div>
                                         <p className="text-xs text-slate-400 font-medium leading-relaxed">Você pode sobrescrever a persona padrão do sistema apenas para esta campanha.</p>
                                         <textarea className="input-premium h-64 font-medium text-sm leading-relaxed p-6 border-emerald-100 focus:ring-emerald-500/10" value={newCampaign.aiPersona} onChange={e => setNewCampaign({...newCampaign, aiPersona: e.target.value})} />
                                     </div>
                                 </div>
                             )}
                         </div>

                         {/* Wizard Footer */}
                         <div className="p-10 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                             {campaignStep > 1 ? (
                                 <button onClick={() => setCampaignStep(s => s - 1)} className="btn-secondary py-4 px-8 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                                     <ArrowLeft size={16} /> Voltar
                                 </button>
                             ) : <div></div>}

                             {campaignStep < 3 ? (
                                 <button onClick={() => setCampaignStep(s => s + 1)} className="btn-primary py-4 px-8 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl" disabled={campaignStep === 2 && selectedIds.size === 0}>
                                     Próximo <ArrowRight size={16} />
                                 </button>
                             ) : (
                                 <button onClick={createCampaign} className="bg-emerald-500 text-white py-4 px-10 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 hover:scale-105 transition-all shadow-xl shadow-emerald-500/30 flex items-center gap-3">
                                     <Play size={18} fill="currentColor" /> Disparar Campanha
                                 </button>
                             )}
                         </div>
                     </div>
                 )}
             </div>
          )}

          {/* LEADS TAB */}
          {activeTab === 'leads' && (
            <div className="space-y-8 animate-fade-in max-w-[1700px] mx-auto pb-24">
                <FilterBar filters={filters} setFilters={setFilters} availableCities={availableCities} availableReasons={availableReasons} totalResults={filteredCompanies.length} />
                <CompanyTable 
                    companies={filteredCompanies} 
                    selectedIds={selectedIds} 
                    toggleSelection={toggleSelection} 
                    toggleSelectAll={toggleSelectAll} 
                    selectable={true}
                    onToggleAi={toggleLeadAI}
                    onChat={(lead: CompanyResult) => { setActiveTab('whatsapp'); setActiveChat(lead.telefone?.replace(/\D/g, '') + '@c.us'); }}
                />
            </div>
          )}

          {/* KANBAN TAB */}
          {activeTab === 'kanban' && (
            <div className="h-full flex gap-10 overflow-x-auto pb-10 animate-fade-in custom-scrollbar">
                {['pending', 'sent', 'replied', 'interested', 'not_interested'].map((status) => (
                    <div key={status} className="w-[340px] shrink-0 flex flex-col h-full bg-slate-200/30 rounded-[40px] border border-slate-200/50 p-6 shadow-inner animate-slide-up">
                        <div className="flex justify-between items-center mb-8 px-4">
                            <h3 className="font-black text-slate-700 uppercase text-xs tracking-[0.25em] flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full ${status === 'pending' ? 'bg-slate-400' : status === 'interested' ? 'bg-emerald-500' : 'bg-brand-500'}`}></div>
                                {status === 'pending' ? 'Prospecção' : status === 'sent' ? 'Contatados' : status === 'replied' ? 'Engajamento' : status === 'interested' ? 'Quentes' : 'Perdidos'}
                            </h3>
                            <span className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-xl text-[10px] font-black text-slate-500 border border-slate-200/50 shadow-sm tabular-nums">
                                {companies.filter(c => c.campaignStatus === status).length}
                            </span>
                        </div>
                        <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-1">
                            {companies.filter(c => c.campaignStatus === status).map(lead => (
                                <KanbanCard key={lead.id} company={lead} onClick={() => { setActiveTab('whatsapp'); setActiveChat(lead.telefone?.replace(/\D/g, '') + '@c.us'); }} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
          )}

          {/* KNOWLEDGE TAB (Com Sync de DB) */}
          {activeTab === 'knowledge' && (
            <div className="max-w-[1500px] mx-auto space-y-12 pb-32 animate-fade-in">
                <div className="flex items-center justify-between bg-white p-12 rounded-[56px] shadow-xl border border-slate-50 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-transparent pointer-events-none"></div>
                    <div className="relative z-10">
                        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2 leading-none">Kernel Inteligente</h2>
                        <p className="text-slate-400 font-black uppercase text-[11px] tracking-[0.3em] opacity-80">Heurística de Respostas Baseada em Motivos SEFAZ</p>
                    </div>
                    <button onClick={() => setEditingRule({ id: uuidv4(), motivoSituacao: '', instructions: [], isActive: true })} className="btn-primary py-5 px-12 shadow-[0_20px_40px_rgba(59,130,246,0.3)] text-xs font-black uppercase tracking-[0.2em] flex items-center gap-4 hover:scale-105 transition-all duration-500">
                        <Plus size={24} strokeWidth={3} /> Nova Regra
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
                    {aiConfig.knowledgeRules.map(rule => (
                        <div key={rule.id} className="card-premium p-10 group flex flex-col h-[520px] border-none shadow-xl hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.12)] hover:-translate-y-2 transition-all duration-700 overflow-hidden relative animate-slide-up">
                            <div className="absolute top-0 right-0 p-12 opacity-[0.03] -rotate-12 group-hover:rotate-0 transition-transform duration-1000"><BookOpen size={200} /></div>
                            <div className="flex justify-between items-start mb-8 relative z-10">
                                <div className="p-4 bg-brand-50 text-brand-600 rounded-3xl group-hover:bg-brand-600 group-hover:text-white transition-all duration-500 shadow-sm ring-1 ring-brand-100"><BookOpen size={28} /></div>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingRule(rule)} className="p-3 text-slate-300 hover:text-brand-500 hover:bg-slate-50 rounded-2xl transition-all active:scale-90"><Edit size={22}/></button>
                                    <button onClick={() => {
                                        const nr = aiConfig.knowledgeRules.filter(r => r.id !== rule.id);
                                        saveAiConfig({...aiConfig, knowledgeRules: nr});
                                    }} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all active:scale-90"><Trash2 size={22}/></button>
                                </div>
                            </div>
                            <h4 className="font-black text-slate-800 text-lg mb-4 uppercase leading-tight line-clamp-3 h-20 group-hover:text-brand-800 transition-colors relative z-10">{rule.motivoSituacao}</h4>
                            <div className="mt-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-3 z-10">
                                {rule.instructions.map((inst, i) => (
                                    <div key={i} className="p-5 bg-slate-50/80 rounded-3xl border border-slate-100 group-hover:bg-white transition-colors shadow-sm">
                                        <p className="text-[12px] text-slate-600 font-semibold italic leading-relaxed tracking-tight">"{inst.content}"</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {editingRule && (
                    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-2xl flex items-center justify-center p-8">
                        <div className="bg-white w-full max-w-3xl rounded-[56px] shadow-2xl flex flex-col max-h-[90vh] animate-slide-up ring-1 ring-white/20">
                            <div className="p-12 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Editor de Regras IA</h3>
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2 mt-2"><Database size={12} /> Sincronizado com Banco de Dados</p>
                                </div>
                                <button onClick={() => setEditingRule(null)} className="p-4 hover:bg-white hover:text-rose-500 rounded-[28px] text-slate-400 transition-all shadow-sm active:scale-90"><X size={32}/></button>
                            </div>
                            <div className="p-12 overflow-y-auto custom-scrollbar space-y-12 flex-1 bg-white">
                                <div className="space-y-4">
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 ml-2">Motivo SEFAZ (Alvo)</label>
                                    <div className="relative group">
                                        <input 
                                            list="db-reasons"
                                            className="input-premium font-black text-slate-900 py-5 rounded-[24px] tracking-tight uppercase shadow-inner" 
                                            placeholder="Selecione ou digite um motivo..." 
                                            value={editingRule.motivoSituacao} 
                                            onChange={e => setEditingRule({...editingRule, motivoSituacao: e.target.value})} 
                                        />
                                        <datalist id="db-reasons">
                                            {availableReasons.map((reason, idx) => <option key={idx} value={reason} />)}
                                        </datalist>
                                        <Search size={20} className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                    </div>
                                    <p className="text-[10px] text-slate-400 ml-4 font-bold">Dica: Use a lista suspensa para selecionar motivos exatos que já existem na sua base.</p>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center mb-6 ml-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Diretrizes de Comportamento IA</label>
                                        <button onClick={() => setEditingRule({...editingRule, instructions: [...editingRule.instructions, { id: uuidv4(), title: 'Info', type: 'simple', content: '' }]})} className="px-5 py-2 bg-brand-50 text-brand-700 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-600 hover:text-white transition-all shadow-sm">+ Adicionar</button>
                                    </div>
                                    <div className="space-y-6">
                                        {editingRule.instructions.map((inst, i) => (
                                            <div key={i} className="flex gap-5 items-start animate-fade-in group/edit">
                                                <div className="flex-1 relative">
                                                   <textarea className="input-premium flex-1 min-h-[120px] text-sm font-semibold leading-relaxed p-6 rounded-[32px] shadow-sm focus:ring-brand-500/20" value={inst.content} onChange={e => {
                                                        const ni = [...editingRule.instructions]; ni[i].content = e.target.value; setEditingRule({...editingRule, instructions: ni});
                                                    }} placeholder="A IA deve responder para este lead que..." />
                                                </div>
                                                <button onClick={() => {
                                                    const ni = editingRule.instructions.filter((_, idx) => idx !== i); setEditingRule({...editingRule, instructions: ni});
                                                }} className="p-4 text-rose-200 hover:text-rose-500 hover:bg-rose-50 mt-4 transition-all rounded-2xl active:scale-90"><Trash2 size={24}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="p-12 bg-slate-50 border-t border-slate-100 flex gap-6 rounded-b-[56px]">
                                <button onClick={() => setEditingRule(null)} className="flex-1 py-5 font-black text-xs uppercase text-slate-400 tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                                <button onClick={() => {
                                     const nr = aiConfig.knowledgeRules.filter(r => r.id !== editingRule.id); nr.push(editingRule);
                                     saveAiConfig({...aiConfig, knowledgeRules: nr}); setEditingRule(null);
                                }} className="flex-[2] btn-primary py-5 uppercase font-black text-sm tracking-[0.3em] shadow-2xl shadow-brand-500/30 rounded-[28px]">Salvar no Kernel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          )}

           {/* SETTINGS TAB */}
           {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-12 animate-fade-in pb-32">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="card-premium p-12 space-y-10 bg-white border-none shadow-2xl rounded-[48px]">
                        <div className="flex items-center gap-5">
                          <div className="p-4 bg-brand-50 text-brand-600 rounded-[24px] shadow-sm"><Cpu size={32} /></div>
                          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Provedor IA</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <button onClick={() => setAiConfig({...aiConfig, provider: 'gemini', model: 'gemini-3-flash-preview'})} className={`p-8 rounded-[36px] border-2 flex flex-col items-center gap-5 transition-all duration-500 group ${aiConfig.provider === 'gemini' ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xl shadow-brand-500/10' : 'border-slate-50 bg-slate-50/50 text-slate-400 hover:border-slate-200'}`}>
                                <Bot size={44} className={`transition-transform duration-500 ${aiConfig.provider === 'gemini' ? 'scale-110' : 'group-hover:scale-110'}`} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Google Gemini</span>
                            </button>
                            <button onClick={() => setAiConfig({...aiConfig, provider: 'groq', model: 'llama-3.1-8b-instant'})} className={`p-8 rounded-[36px] border-2 flex flex-col items-center gap-5 transition-all duration-500 group ${aiConfig.provider === 'groq' ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xl shadow-brand-500/10' : 'border-slate-50 bg-slate-50/50 text-slate-400 hover:border-slate-200'}`}>
                                <Rocket size={44} className={`transition-transform duration-500 ${aiConfig.provider === 'groq' ? 'scale-110' : 'group-hover:scale-110'}`} />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Groq Llama</span>
                            </button>
                        </div>
                        <div className="p-8 bg-slate-50/80 rounded-[32px] border border-slate-100/50">
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] leading-relaxed">As chaves de API são gerenciadas via ambiente de servidor para máxima segurança de ponta a ponta.</p>
                        </div>
                    </div>

                    <div className="card-premium p-12 space-y-10 bg-white border-none shadow-2xl rounded-[48px]">
                        <div className="flex items-center gap-5">
                          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-[24px] shadow-sm"><User size={32} /></div>
                          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Persona IA</h3>
                        </div>
                        <div className="space-y-6">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 ml-2">System Instruction (Persona)</label>
                            <textarea className="input-premium h-64 text-sm font-semibold leading-relaxed p-8 rounded-[36px] shadow-inner focus:ring-emerald-500/20" value={aiConfig.persona} onChange={e => setAiConfig({...aiConfig, persona: e.target.value})} />
                            <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase px-2">
                              <span>Professional</span>
                              <span>Contextual</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card-premium p-12 bg-gradient-to-br from-rose-600 to-rose-800 border-none text-white flex flex-col md:flex-row items-center justify-between shadow-2xl rounded-[48px] group relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    <div className="flex items-center gap-8 relative z-10 text-center md:text-left">
                        <div className="p-6 bg-white/20 rounded-[36px] shadow-xl backdrop-blur-md group-hover:scale-110 transition-transform duration-500"><AlertCircle size={44} strokeWidth={2.5} /></div>
                        <div>
                            <h4 className="text-3xl font-black uppercase tracking-tighter">Danger Zone</h4>
                            <p className="text-rose-100/80 text-xs font-bold mt-1 uppercase tracking-widest">Ações Irreversíveis de Sistema</p>
                        </div>
                    </div>
                    <button onClick={async () => { if(confirm("Confirmar limpeza de base órfã?")) { await fetch('/api/cleanup', {method:'POST'}); fetchCompanies(); } }} className="mt-8 md:mt-0 bg-white text-rose-700 px-12 py-5 rounded-[28px] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl hover:bg-rose-50 hover:scale-105 active:scale-95 transition-all relative z-10">Limpar Base Órfã</button>
                </div>

                <div className="flex justify-end pt-8">
                    <button onClick={() => saveAiConfig(aiConfig)} className="btn-primary py-6 px-20 uppercase font-black text-sm tracking-[0.4em] shadow-[0_32px_64px_-12px_rgba(37,99,235,0.4)] rounded-[32px] hover:scale-[1.03] active:scale-95 transition-all duration-500">Salvar Todas Alterações</button>
                </div>
            </div>
          )}

          {/* OTHER TABS (WA) - Same as before */}
          {activeTab === 'whatsapp' && (
            <div className="flex h-full gap-10 animate-fade-in max-w-[1800px] mx-auto">
                {/* Conversations Sidebar */}
                <div className="w-[480px] card-premium flex flex-col bg-white overflow-hidden border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[40px]">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/40 flex justify-between items-center">
                        <div>
                          <h3 className="font-black text-slate-800 text-sm uppercase tracking-tighter">Conversas Ativas</h3>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Live Feed</p>
                        </div>
                        <Badge variant="brand">{chats.length}</Badge>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-50/80">
                        {chats.map(chat => (
                            <div key={chat.id} onClick={() => { setActiveChat(chat.id); fetchMessages(chat.id); }} className={`p-8 flex gap-6 hover:bg-brand-50/20 cursor-pointer transition-all duration-300 relative group ${activeChat === chat.id ? 'bg-brand-50/50 border-r-[6px] border-brand-600' : ''}`}>
                                <div className="w-16 h-16 rounded-[24px] bg-slate-100 flex items-center justify-center font-black text-slate-400 shrink-0 text-2xl border-2 border-white shadow-md group-hover:scale-110 transition-transform">
                                    {getInitials(chat.name || '??')}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-baseline mb-2">
                                        <p className="font-black text-slate-800 text-xs uppercase tracking-tight truncate pr-6 group-hover:text-brand-700 transition-colors">{chat.name || chat.id.replace(/\D/g, '')}</p>
                                        <span className="text-[10px] font-mono font-bold text-slate-400 whitespace-nowrap">{chat.timestamp ? formatTime(chat.timestamp) : ''}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate leading-relaxed font-medium opacity-80">{chat.lastMessage}</p>
                                </div>
                                {chat.unreadCount > 0 && <div className="absolute right-8 bottom-8 w-6 h-6 bg-brand-600 rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-brand-500/40">{chat.unreadCount}</div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat Window */}
                <div className="flex-1 card-premium flex flex-col bg-[#f0f2f5] overflow-hidden relative border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] rounded-[40px]">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e71a7b327317d924731d7986c.png')]"></div>
                    
                    {activeChat ? (
                        <>
                            <div className="p-8 bg-white/95 backdrop-blur-3xl border-b border-slate-200/60 flex justify-between items-center z-10">
                                <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center font-black text-white text-2xl shadow-xl">
                                        {getInitials(chats.find(c => c.id === activeChat)?.name || '??')}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight truncate max-w-[300px]">{chats.find(c => c.id === activeChat)?.name || activeChat.replace(/\D/g, '')}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>
                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest opacity-80">
                                                {activeChatCompany ? activeChatCompany.razaoSocial?.substring(0, 30) + '...' : 'Live Chat'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {activeChatCompany && (
                                        <button onClick={() => toggleLeadAI(activeChatCompany.id, activeChatCompany.aiActive)} className={`p-4 rounded-[20px] transition-all flex items-center gap-2 ${activeChatCompany.aiActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>
                                            <Bot size={20} />
                                            <span className="text-[10px] font-black uppercase">IA {activeChatCompany.aiActive ? 'Auto' : 'Off'}</span>
                                        </button>
                                    )}
                                    <button className="p-4 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-[20px] transition-all"><MoreVertical size={24}/></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar z-0 flex flex-col">
                                {chatMessages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                        <div className={`max-w-[80%] px-8 py-5 rounded-[32px] text-sm shadow-xl relative transition-all ${msg.fromMe ? 'bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-tr-none shadow-brand-500/20' : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/50'}`}>
                                            <p className="leading-relaxed font-semibold text-[13px] pr-8">{msg.body}</p>
                                            <div className={`flex items-center justify-end gap-2 mt-3 ${msg.fromMe ? 'text-brand-100' : 'text-slate-400'}`}>
                                                <span className="text-[10px] font-mono font-bold opacity-60">{formatTime(msg.timestamp)}</span>
                                                {msg.fromMe && <Check size={14} className="opacity-80" strokeWidth={3}/>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-8 bg-white/95 backdrop-blur-3xl border-t border-slate-200/60 flex items-center gap-6 z-10">
                                <button className="p-4 text-slate-400 hover:text-brand-500 transition-colors"><Smile size={28}/></button>
                                <div className="flex-1 relative">
                                    <input 
                                        className="w-full bg-slate-100/80 border-none rounded-[28px] px-10 py-5 text-sm font-bold focus:ring-[6px] focus:ring-brand-500/10 transition-all shadow-inner text-slate-800"
                                        placeholder="Digite aqui sua mensagem ou comando IA..."
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                    />
                                </div>
                                <button onClick={handleSendMessage} className="p-6 bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-[32px] shadow-[0_20px_40px_rgba(59,130,246,0.3)] hover:scale-105 active:scale-95 transition-all">
                                    <Send size={28} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center animate-fade-in relative">
                            <div className="w-32 h-32 bg-white rounded-[44px] shadow-[0_24px_48px_rgba(0,0,0,0.1)] flex items-center justify-center text-slate-200 mb-10 border border-slate-50 relative z-10">
                                <MessageCircle size={64} className="opacity-20" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter relative z-10">WhatsApp Engine Ready</h2>
                            <p className="text-xs max-w-sm mt-4 font-black uppercase tracking-[0.25em] text-slate-400 relative z-10 opacity-70">Selecione um lead no pool para interagir</p>
                        </div>
                    )}
                </div>
            </div>
          )}

          {/* IMPORT TAB */}
          {activeTab === 'import' && (
            <div className="max-w-4xl mx-auto animate-fade-in space-y-12 pb-20">
                <div className="card-premium p-20 text-center border-2 border-dashed border-slate-200/80 hover:border-brand-500/50 transition-all duration-700 bg-white relative overflow-hidden group shadow-2xl shadow-slate-200/50 rounded-[48px]">
                    <div className="absolute top-0 right-0 p-16 opacity-[0.03] -rotate-12 group-hover:rotate-0 group-hover:scale-125 transition-transform duration-1000">
                        <FileSpreadsheet size={300} />
                    </div>
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (!file) return;
                         const fd = new FormData(); fd.append('file', file);
                         fetch('/start-processing', {method: 'POST', body: fd}).then(() => fetchImports());
                    }} />
                    <div className="w-28 h-28 bg-brand-50 text-brand-600 rounded-[44px] flex items-center justify-center mx-auto mb-10 shadow-inner group-hover:scale-110 transition-transform duration-500 ring-4 ring-brand-50/50">
                        <Upload size={44} strokeWidth={2.5} />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">DATA PIPELINE</h2>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto font-medium leading-relaxed opacity-70">
                      Arraste o PDF da consulta consolidada da SEFAZ. Nosso motor irá processar os metadados e atualizar a base inteligente.
                    </p>
                </div>

                <div className="card-premium overflow-hidden border-none shadow-2xl rounded-[32px]">
                    <div className="bg-[#0f172a] px-10 py-6 flex justify-between items-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-brand-600 opacity-5 pointer-events-none"></div>
                        <h3 className="font-black text-white text-[10px] uppercase tracking-[0.3em] relative z-10 flex items-center gap-3">
                           <Activity size={14} className="text-brand-500" /> Extracted Batches
                        </h3>
                        <div className="flex items-center gap-4 relative z-10">
                          <Badge variant="brand">High Volume Ready</Badge>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100 bg-white">
                        {imports.length === 0 && (
                          <div className="p-20 text-center space-y-4">
                            <Rocket size={40} className="mx-auto text-slate-200" />
                            <p className="text-sm font-bold text-slate-400 italic">Nenhuma importação pendente.</p>
                          </div>
                        )}
                        {imports.map(imp => (
                            <div key={imp.id} className="px-10 py-8 flex items-center justify-between hover:bg-slate-50/80 transition-all duration-300 group">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-white rounded-3xl border border-slate-100 flex items-center justify-center text-slate-300 shadow-sm group-hover:text-brand-600 group-hover:border-brand-200 transition-all">
                                        <FileSpreadsheet size={32} strokeWidth={1.5} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="font-black text-slate-800 uppercase text-sm tracking-tight group-hover:text-brand-700 transition-colors">{imp.filename}</p>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1.5">
                                              <Activity size={10} className="text-slate-400" />
                                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{new Date(imp.date).toLocaleDateString()}</span>
                                            </div>
                                            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                            <span className="text-[10px] text-brand-500 font-black uppercase tracking-widest">{imp.total} REGISTROS EXTRAÍDOS</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <Badge variant={imp.status === 'completed' ? 'success' : 'warning'}>{imp.status.toUpperCase()}</Badge>
                                    <button onClick={() => deleteImport(imp.id)} className="p-4 text-slate-300 hover:text-rose-500 transition-all rounded-2xl hover:bg-rose-50 shadow-sm active:scale-90">
                                      <Trash2 size={22}/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default App;
