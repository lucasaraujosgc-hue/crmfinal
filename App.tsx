import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Upload, MessageCircle, Bot, Settings, Menu, FileSpreadsheet, Search,
  CheckCircle2, AlertCircle, Send, RefreshCw, BookOpen, Plus, Trash2,
  User, X, Save, Rocket, Trello, Edit, Power, Phone,
  MoreVertical, Smile, Paperclip as PaperclipIcon, Check, Eye, EyeOff, Cpu, Terminal,
  ChevronRight, Globe, ShieldCheck, Zap, Activity, BarChart3, PieChart as PieChartIcon,
  Database, Filter, ArrowLeft, ArrowRight, Play, Clock, ScrollText, QrCode
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

interface BadgeProps {
  children: React.ReactNode;
  variant?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'default' }) => {
  const styles: Record<string, string> = {
    default: 'bg-slate-100 text-slate-600 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/50',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/50',
    brand: 'bg-brand-50 text-brand-700 border-brand-200/50',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${styles[variant] || styles.default} backdrop-blur-sm`}>
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
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${map[status] || map['pending']}`}>
            {status}
        </span>
    );
};

// --- Componentes Funcionais Reutilizáveis ---

// Barra de Filtros Compactada
const FilterBar = ({ filters, setFilters, availableCities, availableReasons, onRefresh, totalResults }: any) => (
    <div className="card-premium p-4 flex flex-col xl:flex-row gap-4 items-center justify-between bg-white border-none shadow-lg rounded-[24px] mb-6">
        <div className="flex-1 relative group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors" size={16} />
            <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-brand-500/10 transition-all placeholder:text-slate-300 shadow-inner"
                placeholder="Filtrar por Razão Social, CNPJ..."
                value={filters.search}
                onChange={e => setFilters({...filters, search: e.target.value})}
            />
        </div>
        <div className="flex items-center gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 custom-scrollbar">
            <select className="bg-slate-50 border-none rounded-xl px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 focus:ring-2 focus:ring-brand-500/10 cursor-pointer shadow-sm min-w-[120px]"
                value={filters.city} onChange={e => setFilters({...filters, city: e.target.value})}>
                <option value="">Todas Cidades</option>
                {availableCities.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
            
            <select className="bg-slate-50 border-none rounded-xl px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 focus:ring-2 focus:ring-brand-500/10 cursor-pointer shadow-sm min-w-[120px]"
                value={filters.reason} onChange={e => setFilters({...filters, reason: e.target.value})}>
                <option value="">Todos Motivos</option>
                {availableReasons.map((r: string) => <option key={r} value={r}>{r}</option>)}
            </select>

            <select className="bg-slate-50 border-none rounded-xl px-3 py-2.5 text-[10px] font-black uppercase text-slate-600 focus:ring-2 focus:ring-brand-500/10 cursor-pointer shadow-sm min-w-[120px]"
                value={filters.statusWa} onChange={e => setFilters({...filters, statusWa: e.target.value})}>
                <option value="all">Status Zap</option>
                <option value="pending">Pendente</option>
                <option value="sent">Enviado</option>
                <option value="replied">Respondido</option>
                <option value="interested">Quente</option>
            </select>
            
            {onRefresh && (
                <button onClick={onRefresh} className="p-2.5 bg-slate-100 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-xl transition-all">
                    <RefreshCw size={16} />
                </button>
            )}
        </div>
        {totalResults !== undefined && (
             <div className="px-4 py-2 bg-slate-100 rounded-xl font-black text-slate-500 text-[10px] whitespace-nowrap">
                 {totalResults} LEADS
             </div>
        )}
    </div>
);

// Tabela de Empresas Compactada
const CompanyTable = ({ companies, selectedIds, toggleSelection, toggleSelectAll, selectable = false, onToggleAi, onChat }: any) => (
    <div className="card-premium overflow-hidden border-none shadow-xl rounded-[24px] bg-white">
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100/50">
                        {selectable && (
                            <th className="px-4 py-4 w-12 text-center">
                                <button onClick={toggleSelectAll} className={`p-1.5 rounded transition-colors ${selectedIds.size > 0 && selectedIds.size === companies.length ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                                    <Check size={14} strokeWidth={3} />
                                </button>
                            </th>
                        )}
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Empresa / Fiscal</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Motivo SEFAZ</th>
                        {onToggleAi && <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">IA Auto</th>}
                        {onChat && <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ação</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {companies.slice(0, 100).map((lead: CompanyResult) => (
                        <tr key={lead.id} className={`group transition-all duration-200 ${selectedIds?.has(lead.id) ? 'bg-brand-50/40' : 'hover:bg-slate-50/50'}`}>
                            {selectable && (
                                <td className="px-4 py-3 text-center">
                                    <button onClick={() => toggleSelection(lead.id)} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedIds.has(lead.id) ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-300 text-transparent hover:border-brand-300'}`}>
                                        <Check size={10} strokeWidth={4} />
                                    </button>
                                </td>
                            )}
                            <td className="px-6 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-400 text-[10px] shadow-sm border border-slate-200/50">
                                        {getInitials(lead.razaoSocial)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-[11px] uppercase tracking-tight truncate max-w-[200px]">{lead.razaoSocial}</p>
                                        <div className="flex gap-2 mt-0.5">
                                            <span className="text-[9px] font-mono text-slate-400 bg-slate-50 px-1 rounded">{lead.cnpj}</span>
                                            <span className="text-[9px] font-bold text-slate-400">{lead.municipio}</span>
                                        </div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-3">
                                <div className="flex flex-col gap-1 items-start">
                                    <Badge variant={lead.situacaoCadastral?.includes('ATIVA') ? 'success' : 'danger'}>{lead.situacaoCadastral}</Badge>
                                    <StatusBadge status={lead.campaignStatus} />
                                </div>
                            </td>
                            <td className="px-6 py-3 max-w-[250px]">
                                <p className="text-[10px] text-slate-500 font-medium italic leading-snug line-clamp-1" title={lead.motivoSituacao}>
                                    "{cleanReasonText(lead.motivoSituacao)}"
                                </p>
                            </td>
                            {onToggleAi && (
                                <td className="px-6 py-3 text-center">
                                    <button onClick={() => onToggleAi(lead.id, lead.aiActive)} className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 focus:outline-none ${lead.aiActive ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                        <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${lead.aiActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </td>
                            )}
                            {onChat && (
                                <td className="px-6 py-3 text-right">
                                    <button onClick={() => onChat(lead)} className="p-2 bg-white text-brand-600 border border-brand-100 rounded-lg hover:bg-brand-600 hover:text-white transition-all shadow-sm active:scale-90">
                                        <MessageCircle size={16} strokeWidth={2.5} />
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

// Card Kanban Compacto
interface KanbanCardProps {
    company: CompanyResult;
    onClick: () => void;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ company, onClick }) => (
    <div onClick={onClick} className="bg-white p-4 rounded-[16px] shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer border border-slate-100 group relative overflow-hidden mb-3">
        <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-br from-slate-50 to-slate-100 rounded-bl-[24px] -mr-3 -mt-3 transition-all group-hover:scale-125"></div>
        
        <div className="flex justify-between items-start mb-2 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center font-black text-slate-400 text-[10px] border border-slate-100">
                {getInitials(company.razaoSocial)}
            </div>
            {company.aiActive && (
                <div className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1 border border-emerald-100">
                    <Bot size={8} /> Auto
                </div>
            )}
        </div>
        
        <h4 className="font-bold text-slate-800 text-xs leading-tight mb-2 line-clamp-2 relative z-10 group-hover:text-brand-600 transition-colors">
            {company.razaoSocial}
        </h4>
        
        <div className="flex items-center gap-2 mb-2 relative z-10">
            <Badge variant={company.situacaoCadastral?.includes('ATIVA') ? 'success' : 'danger'}>{company.situacaoCadastral}</Badge>
            <span className="text-[9px] font-mono text-slate-400">{company.municipio}</span>
        </div>

        {company.lastContacted && (
             <div className="pt-2 border-t border-slate-50 flex items-center gap-1.5 text-slate-400 relative z-10">
                 <Clock size={10} />
                 <span className="text-[9px] font-bold uppercase tracking-wide">
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
  
  // Logs State
  const [logs, setLogs] = useState<any[]>([]);

  // Import Process State
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);

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
    if (activeTab === 'logs') {
        fetchLogs();
    }
  }, 3000);

  // --- API Calls ---

  const fetchLogs = async () => {
    try {
        const res = await fetch('/api/logs');
        if (res.ok) setLogs(await res.json());
    } catch(e) {}
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
      
      {/* Sidebar Compactada */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#0f172a] text-white transition-all duration-300 ease-in-out flex flex-col z-30 shadow-[4px_0_24px_rgba(0,0,0,0.15)] relative`}>
        <div className="p-6 border-b border-white/5 flex items-center justify-between overflow-hidden">
          {isSidebarOpen ? (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-700 rounded-xl flex items-center justify-center shadow-[0_8px_16px_rgba(59,130,246,0.3)] ring-1 ring-white/20">
                <Rocket className="text-white" size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-lg tracking-tight leading-none">VIRGULA</h2>
                <p className="text-[8px] text-brand-400 font-black uppercase tracking-[0.25em] mt-1 opacity-80">CRM</p>
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 bg-brand-600/10 rounded-xl flex items-center justify-center border border-brand-500/20 mx-auto">
                <Rocket className="text-brand-500" size={18} />
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 mt-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'kanban', icon: Trello, label: 'Kanban' },
            { id: 'import', icon: Upload, label: 'Importar PDF' },
            { id: 'campaigns', icon: Rocket, label: 'Campanhas' },
            { id: 'leads', icon: FileSpreadsheet, label: 'Base de Leads' },
            { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', badge: waSession.status === 'connected' ? 'On' : 'Off' },
            { id: 'knowledge', icon: BookOpen, label: 'Base de IA' },
            { id: 'logs', icon: ScrollText, label: 'Monitor (Logs)' },
            { id: 'settings', icon: Settings, label: 'Configurações' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 relative ${
                activeTab === item.id ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              {isSidebarOpen && <span className="font-bold text-xs truncate">{item.label}</span>}
              {activeTab === item.id && <div className="absolute right-0 w-1 h-5 bg-white rounded-l-full shadow-[0_0_12px_white]"></div>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 bg-black/20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bot size={16} className={aiConfig.aiActive ? "text-emerald-400 shadow-[0_0_10px_#10b981]" : "text-slate-500"} />
                    {isSidebarOpen && <span className="text-[10px] font-bold uppercase tracking-widest">IA Geral</span>}
                </div>
                <button onClick={() => saveAiConfig({...aiConfig, aiActive: !aiConfig.aiActive})} className={`w-8 h-4 rounded-full p-0.5 transition-all ${aiConfig.aiActive ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full transition-all ${aiConfig.aiActive ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header Compacto */}
        <header className="h-16 bg-white/70 backdrop-blur-2xl border-b border-slate-200/60 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all active:scale-90">
              <Menu size={20} />
            </button>
            <div className="h-6 w-px bg-slate-200"></div>
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-tight">{activeTab}</h1>
          </div>

          <div className="flex items-center gap-4">
             <button onClick={fetchCompanies} className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-brand-600 transition-all group">
                <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-700" />
             </button>
             <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border shadow-sm ${waSession.status === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${waSession.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                <span className="text-[9px] font-black uppercase tracking-widest">Zap: {waSession.status.toUpperCase()}</span>
             </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50/40 custom-scrollbar">
          
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fade-in max-w-[1600px] mx-auto pb-20">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Total Base', value: stats.total, icon: FileSpreadsheet, color: 'text-brand-600', bg: 'bg-brand-50' },
                  { label: 'Sucesso Extração', value: stats.success, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Erros SEFAZ', value: stats.errors, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                  { label: 'Campanhas', value: campaigns.length, icon: Rocket, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map((stat, i) => (
                  <div key={i} className="card-premium p-6 group card-hover border-none relative overflow-hidden">
                    <div className={`absolute top-0 right-0 p-6 ${stat.color} opacity-[0.03] group-hover:scale-125 transition-transform duration-700`}><stat.icon size={80} /></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300 shadow-sm`}><stat.icon size={20} strokeWidth={2.5} /></div>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-1 relative z-10">{stat.value}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] relative z-10">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LOGS TAB - NEW */}
          {activeTab === 'logs' && (
             <div className="max-w-[1400px] mx-auto animate-fade-in pb-20 space-y-6">
                 <div className="flex items-center justify-between">
                     <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                         <ScrollText size={24} className="text-brand-600" /> System Monitor
                     </h2>
                     <button onClick={fetchLogs} className="btn-ghost text-xs font-bold uppercase">Refresh Logs</button>
                 </div>
                 
                 <div className="card-premium border-none shadow-xl bg-[#0f172a] text-slate-300 font-mono text-xs overflow-hidden rounded-[24px]">
                     <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-900/50">
                         <span className="font-bold text-brand-400 flex items-center gap-2"><Terminal size={14}/> LIVE LOG STREAM</span>
                         <div className="flex gap-2">
                             <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                             <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse delay-75"></span>
                             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-150"></span>
                         </div>
                     </div>
                     <div className="max-h-[600px] overflow-y-auto custom-scrollbar p-6 space-y-2">
                         {logs.length === 0 && <p className="text-slate-600 italic text-center py-10">Aguardando eventos do sistema...</p>}
                         {logs.map((log: any) => (
                             <div key={log.id} className="flex gap-4 hover:bg-white/5 p-1 rounded transition-colors">
                                 <span className="text-slate-500 shrink-0 w-32">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                 <span className={`shrink-0 w-24 font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded text-center ${
                                     log.type === 'error' ? 'bg-rose-500/20 text-rose-400' :
                                     log.type === 'ai_success' ? 'bg-emerald-500/20 text-emerald-400' :
                                     log.type === 'ai_skip' ? 'bg-amber-500/20 text-amber-400' :
                                     log.type === 'msg_in' ? 'bg-blue-500/20 text-blue-400' :
                                     'bg-slate-700 text-slate-300'
                                 }`}>{log.type}</span>
                                 <span className="text-brand-200 shrink-0 w-24">[{log.source}]</span>
                                 <span className="text-slate-300 flex-1">{log.message}</span>
                                 {log.meta && log.meta !== '{}' && (
                                     <span className="text-slate-500 truncate max-w-[200px]" title={log.meta}>{log.meta}</span>
                                 )}
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
          )}

          {/* CAMPAIGNS - WIZARD RESTORED & COMPACTED */}
          {activeTab === 'campaigns' && (
             <div className="max-w-[1600px] mx-auto animate-fade-in pb-32">
                 {!isCreatingCampaign ? (
                     <div className="space-y-8">
                         <div className="flex justify-between items-center bg-white p-6 rounded-[24px] shadow-lg border border-slate-50">
                             <div>
                                 <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Gestão de Campanhas</h2>
                                 <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Automação de Disparos em Massa com IA</p>
                             </div>
                             <button onClick={() => { setIsCreatingCampaign(true); setCampaignStep(1); }} className="btn-primary py-3 px-6 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-500/30">
                                 <Plus size={16} strokeWidth={3} /> Nova Campanha
                             </button>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                             {campaigns.map(c => (
                                 <div key={c.id} className="card-premium p-6 group relative hover:border-brand-300 transition-all">
                                     <div className="flex justify-between items-start mb-4">
                                         <div className="p-3 bg-brand-50 text-brand-600 rounded-xl shadow-sm"><Rocket size={20} /></div>
                                         <Badge variant="success">Ativa</Badge>
                                     </div>
                                     <h3 className="font-black text-lg text-slate-800 mb-1 truncate">{c.name}</h3>
                                     <p className="text-[10px] text-slate-400 line-clamp-2 mb-4 font-medium">{c.description || 'Sem descrição definida.'}</p>
                                     <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-50">
                                         <div className="text-center">
                                             <p className="text-[9px] font-black text-slate-300 uppercase">Total</p>
                                             <p className="font-bold text-slate-700 text-sm">{c.stats?.total || 0}</p>
                                         </div>
                                         <div className="text-center border-l border-slate-50">
                                             <p className="text-[9px] font-black text-slate-300 uppercase">Enviados</p>
                                             <p className="font-bold text-brand-600 text-sm">{c.stats?.sent || 0}</p>
                                         </div>
                                         <div className="text-center border-l border-slate-50">
                                             <p className="text-[9px] font-black text-slate-300 uppercase">Respostas</p>
                                             <p className="font-bold text-emerald-600 text-sm">{c.stats?.replied || 0}</p>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 ) : (
                     <div className="max-w-6xl mx-auto bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
                         {/* Wizard Header */}
                         <div className="bg-slate-50/80 p-6 border-b border-slate-100 flex items-center justify-between">
                             <div>
                                 <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Setup de Campanha</h2>
                                 <div className="flex items-center gap-2 mt-1">
                                     <span className={`h-1.5 w-1.5 rounded-full ${campaignStep >= 1 ? 'bg-brand-500' : 'bg-slate-300'}`}></span>
                                     <span className={`h-1.5 w-6 rounded-full ${campaignStep >= 2 ? 'bg-brand-500' : 'bg-slate-300'}`}></span>
                                     <span className={`h-1.5 w-1.5 rounded-full ${campaignStep >= 3 ? 'bg-brand-500' : 'bg-slate-300'}`}></span>
                                     <span className="ml-2 text-[9px] font-black uppercase text-slate-400 tracking-widest">Passo {campaignStep} de 3</span>
                                 </div>
                             </div>
                             <button onClick={() => setIsCreatingCampaign(false)} className="p-2 hover:bg-white hover:text-rose-500 rounded-xl transition-all shadow-sm"><X size={20}/></button>
                         </div>

                         {/* Wizard Body */}
                         <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                             {campaignStep === 1 && (
                                 <div className="max-w-xl mx-auto space-y-6 animate-slide-up">
                                     <div className="text-center mb-8">
                                         <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm"><FileSpreadsheet size={28} /></div>
                                         <h3 className="text-lg font-black text-slate-800">Definições Iniciais</h3>
                                         <p className="text-slate-400 text-xs font-medium mt-1">Dê um nome para identificar este lote de disparos.</p>
                                     </div>
                                     <div className="space-y-4">
                                         <div>
                                             <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nome da Campanha</label>
                                             <input className="input-premium font-bold text-base" placeholder="Ex: Lote Inaptidão 2024 - BA" value={newCampaign.name} onChange={e => setNewCampaign({...newCampaign, name: e.target.value})} autoFocus />
                                         </div>
                                         <div>
                                             <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Descrição (Opcional)</label>
                                             <textarea className="input-premium h-24 resize-none text-xs" placeholder="Detalhes sobre o público alvo..." value={newCampaign.description} onChange={e => setNewCampaign({...newCampaign, description: e.target.value})} />
                                         </div>
                                     </div>
                                 </div>
                             )}

                             {campaignStep === 2 && (
                                 <div className="space-y-4 animate-slide-up h-full flex flex-col">
                                     <div className="flex items-center justify-between mb-2">
                                         <h3 className="text-lg font-black text-slate-800">Seleção de Leads</h3>
                                         <div className="flex items-center gap-3">
                                             <Badge variant="brand">{selectedIds.size} Selecionados</Badge>
                                             {selectedIds.size > 0 && <button onClick={() => setSelectedIds(new Set())} className="text-[10px] font-bold text-rose-500 hover:underline">Limpar</button>}
                                         </div>
                                     </div>
                                     
                                     <FilterBar filters={filters} setFilters={setFilters} availableCities={availableCities} availableReasons={availableReasons} totalResults={filteredCompanies.length} />
                                     
                                     <div className="flex-1 border border-slate-100 rounded-[24px] overflow-hidden">
                                         <div className="h-[400px] overflow-y-auto custom-scrollbar bg-slate-50/30">
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
                                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up h-full">
                                     <div className="space-y-4">
                                         <div className="flex items-center gap-3 mb-1">
                                             <div className="p-2 bg-brand-50 text-brand-600 rounded-lg"><MessageCircle size={18} /></div>
                                             <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Mensagem Inicial</h3>
                                         </div>
                                         <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Esta mensagem será enviada para iniciar a conversa.</p>
                                         <textarea className="input-premium h-48 font-medium text-xs leading-relaxed p-4" value={newCampaign.initialMessage} onChange={e => setNewCampaign({...newCampaign, initialMessage: e.target.value})} />
                                     </div>
                                     <div className="space-y-4">
                                         <div className="flex items-center gap-3 mb-1">
                                             <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Bot size={18} /></div>
                                             <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Persona Específica</h3>
                                         </div>
                                         <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Sobrescrever a persona padrão.</p>
                                         <textarea className="input-premium h-48 font-medium text-xs leading-relaxed p-4 border-emerald-100 focus:ring-emerald-500/10" value={newCampaign.aiPersona} onChange={e => setNewCampaign({...newCampaign, aiPersona: e.target.value})} />
                                     </div>
                                 </div>
                             )}
                         </div>

                         {/* Wizard Footer */}
                         <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                             {campaignStep > 1 ? (
                                 <button onClick={() => setCampaignStep(s => s - 1)} className="btn-secondary py-3 px-6 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
                                     <ArrowLeft size={14} /> Voltar
                                 </button>
                             ) : <div></div>}

                             {campaignStep < 3 ? (
                                 <button onClick={() => setCampaignStep(s => s + 1)} className="btn-primary py-3 px-6 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg" disabled={campaignStep === 2 && selectedIds.size === 0}>
                                     Próximo <ArrowRight size={14} />
                                 </button>
                             ) : (
                                 <button onClick={createCampaign} className="bg-emerald-500 text-white py-3 px-8 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-600 hover:scale-105 transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-2">
                                     <Play size={14} fill="currentColor" /> Disparar Campanha
                                 </button>
                             )}
                         </div>
                     </div>
                 )}
             </div>
          )}

          {/* LEADS TAB */}
          {activeTab === 'leads' && (
            <div className="space-y-6 animate-fade-in max-w-[1700px] mx-auto pb-24">
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
            <div className="h-full flex gap-6 overflow-x-auto pb-10 animate-fade-in custom-scrollbar">
                {['pending', 'sent', 'replied', 'interested', 'not_interested'].map((status) => (
                    <div key={status} className="w-[300px] shrink-0 flex flex-col h-full bg-slate-200/30 rounded-[32px] border border-slate-200/50 p-4 shadow-inner animate-slide-up">
                        <div className="flex justify-between items-center mb-6 px-2">
                            <h3 className="font-black text-slate-700 uppercase text-[10px] tracking-[0.25em] flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${status === 'pending' ? 'bg-slate-400' : status === 'interested' ? 'bg-emerald-500' : 'bg-brand-500'}`}></div>
                                {status === 'pending' ? 'Prospecção' : status === 'sent' ? 'Contatados' : status === 'replied' ? 'Engajamento' : status === 'interested' ? 'Quentes' : 'Perdidos'}
                            </h3>
                            <span className="bg-white/80 backdrop-blur-md px-2 py-0.5 rounded-lg text-[9px] font-black text-slate-500 border border-slate-200/50 shadow-sm tabular-nums">
                                {companies.filter(c => c.campaignStatus === status).length}
                            </span>
                        </div>
                        <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                            {companies.filter(c => c.campaignStatus === status).map(lead => (
                                <KanbanCard key={lead.id} company={lead} onClick={() => { setActiveTab('whatsapp'); setActiveChat(lead.telefone?.replace(/\D/g, '') + '@c.us'); }} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
          )}

          {/* KNOWLEDGE TAB (Compactada) */}
          {activeTab === 'knowledge' && (
            <div className="max-w-[1400px] mx-auto space-y-8 pb-32 animate-fade-in">
                <div className="flex items-center justify-between bg-white p-8 rounded-[40px] shadow-lg border border-slate-50 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-transparent pointer-events-none"></div>
                    <div className="relative z-10">
                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1 leading-none">Kernel Inteligente</h2>
                        <p className="text-slate-400 font-black uppercase text-[9px] tracking-[0.3em] opacity-80">Heurística de Respostas Baseada em Motivos SEFAZ</p>
                    </div>
                    <button onClick={() => setEditingRule({ id: uuidv4(), motivoSituacao: '', instructions: [], isActive: true })} className="btn-primary py-4 px-8 shadow-lg text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 hover:scale-105 transition-all">
                        <Plus size={18} strokeWidth={3} /> Nova Regra
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {aiConfig.knowledgeRules.map(rule => (
                        <div key={rule.id} className="card-premium p-6 group flex flex-col h-[400px] border-none shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden relative animate-slide-up">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] -rotate-12 group-hover:rotate-0 transition-transform duration-1000"><BookOpen size={150} /></div>
                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div className="p-3 bg-brand-50 text-brand-600 rounded-2xl group-hover:bg-brand-600 group-hover:text-white transition-all duration-500 shadow-sm ring-1 ring-brand-100"><BookOpen size={20} /></div>
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingRule(rule)} className="p-2 text-slate-300 hover:text-brand-500 hover:bg-slate-50 rounded-xl transition-all active:scale-90"><Edit size={18}/></button>
                                    <button onClick={() => {
                                        const nr = aiConfig.knowledgeRules.filter(r => r.id !== rule.id);
                                        saveAiConfig({...aiConfig, knowledgeRules: nr});
                                    }} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all active:scale-90"><Trash2 size={18}/></button>
                                </div>
                            </div>
                            <h4 className="font-black text-slate-800 text-sm mb-3 uppercase leading-tight line-clamp-3 h-12 group-hover:text-brand-800 transition-colors relative z-10">{rule.motivoSituacao}</h4>
                            <div className="mt-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2 z-10">
                                {rule.instructions.map((inst, i) => (
                                    <div key={i} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors shadow-sm">
                                        <p className="text-[10px] text-slate-600 font-semibold italic leading-relaxed tracking-tight">"{inst.content}"</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {editingRule && (
                    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-2xl flex items-center justify-center p-8">
                        <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl flex flex-col max-h-[90vh] animate-slide-up ring-1 ring-white/20">
                            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Editor de Regras IA</h3>
                                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2 mt-1"><Database size={10} /> Sincronizado com Banco de Dados</p>
                                </div>
                                <button onClick={() => setEditingRule(null)} className="p-3 hover:bg-white hover:text-rose-500 rounded-2xl text-slate-400 transition-all shadow-sm active:scale-90"><X size={24}/></button>
                            </div>
                            <div className="p-8 overflow-y-auto custom-scrollbar space-y-8 flex-1 bg-white">
                                <div className="space-y-2">
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2 ml-1">Motivo SEFAZ (Alvo)</label>
                                    <div className="relative group">
                                        <input 
                                            list="db-reasons"
                                            className="input-premium font-black text-slate-900 py-3 rounded-2xl tracking-tight uppercase shadow-inner text-sm" 
                                            placeholder="Selecione ou digite um motivo..." 
                                            value={editingRule.motivoSituacao} 
                                            onChange={e => setEditingRule({...editingRule, motivoSituacao: e.target.value})} 
                                        />
                                        <datalist id="db-reasons">
                                            {availableReasons.map((reason, idx) => <option key={idx} value={reason} />)}
                                        </datalist>
                                        <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                                    </div>
                                    <p className="text-[9px] text-slate-400 ml-2 font-bold">Dica: Use a lista suspensa para selecionar motivos exatos que já existem na sua base.</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2 ml-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Diretrizes de Comportamento IA</label>
                                        <button onClick={() => setEditingRule({...editingRule, instructions: [...editingRule.instructions, { id: uuidv4(), title: 'Info', type: 'simple', content: '' }]})} className="px-4 py-1.5 bg-brand-50 text-brand-700 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-brand-600 hover:text-white transition-all shadow-sm">+ Adicionar</button>
                                    </div>
                                    <div className="space-y-4">
                                        {editingRule.instructions.map((inst, i) => (
                                            <div key={i} className="flex gap-4 items-start animate-fade-in group/edit">
                                                <div className="flex-1 relative">
                                                   <textarea className="input-premium flex-1 min-h-[80px] text-xs font-semibold leading-relaxed p-4 rounded-2xl shadow-sm focus:ring-brand-500/20" value={inst.content} onChange={e => {
                                                        const ni = [...editingRule.instructions]; ni[i].content = e.target.value; setEditingRule({...editingRule, instructions: ni});
                                                    }} placeholder="A IA deve responder para este lead que..." />
                                                </div>
                                                <button onClick={() => {
                                                    const ni = editingRule.instructions.filter((_, idx) => idx !== i); setEditingRule({...editingRule, instructions: ni});
                                                }} className="p-3 text-rose-200 hover:text-rose-500 hover:bg-rose-50 mt-2 transition-all rounded-xl active:scale-90"><Trash2 size={20}/></button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4 rounded-b-[40px]">
                                <button onClick={() => setEditingRule(null)} className="flex-1 py-4 font-black text-[10px] uppercase text-slate-400 tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
                                <button onClick={() => {
                                     const nr = aiConfig.knowledgeRules.filter(r => r.id !== editingRule.id); nr.push(editingRule);
                                     saveAiConfig({...aiConfig, knowledgeRules: nr}); setEditingRule(null);
                                }} className="flex-[2] btn-primary py-4 uppercase font-black text-xs tracking-[0.3em] shadow-xl shadow-brand-500/30 rounded-2xl">Salvar no Kernel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          )}

           {/* SETTINGS TAB */}
           {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-32">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="card-premium p-8 space-y-6 bg-white border-none shadow-xl rounded-[32px]">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-brand-50 text-brand-600 rounded-xl shadow-sm"><Cpu size={24} /></div>
                          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Provedor IA</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => setAiConfig({...aiConfig, provider: 'gemini', model: 'gemini-3-flash-preview'})} className={`p-6 rounded-[24px] border-2 flex flex-col items-center gap-4 transition-all duration-300 group ${aiConfig.provider === 'gemini' ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xl shadow-brand-500/10' : 'border-slate-50 bg-slate-50/50 text-slate-400 hover:border-slate-200'}`}>
                                <Bot size={32} className={`transition-transform duration-300 ${aiConfig.provider === 'gemini' ? 'scale-110' : 'group-hover:scale-110'}`} />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Google Gemini</span>
                            </button>
                            <button onClick={() => setAiConfig({...aiConfig, provider: 'groq', model: 'llama-3.1-8b-instant'})} className={`p-6 rounded-[24px] border-2 flex flex-col items-center gap-4 transition-all duration-300 group ${aiConfig.provider === 'groq' ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-xl shadow-brand-500/10' : 'border-slate-50 bg-slate-50/50 text-slate-400 hover:border-slate-200'}`}>
                                <Rocket size={32} className={`transition-transform duration-300 ${aiConfig.provider === 'groq' ? 'scale-110' : 'group-hover:scale-110'}`} />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Groq Llama</span>
                            </button>
                        </div>

                        {/* API KEYS INPUT - ADICIONADO AQUI */}
                        <div className="mt-6 space-y-3 animate-fade-in border-t border-slate-100 pt-6">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                API Key ({aiConfig.provider === 'gemini' ? 'Google AI Studio' : 'Groq Cloud'})
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    className="input-premium font-mono text-xs pr-10"
                                    placeholder={aiConfig.provider === 'gemini' ? "Cole sua chave AIza..." : "Cole sua chave gsk_..."}
                                    value={aiConfig.provider === 'gemini' ? aiConfig.apiKeys?.gemini || '' : aiConfig.apiKeys?.groq || ''}
                                    onChange={e => {
                                        const k = { ...aiConfig.apiKeys, [aiConfig.provider]: e.target.value };
                                        setAiConfig({ ...aiConfig, apiKeys: k });
                                    }}
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    {aiConfig.provider === 'gemini' ? <Zap size={14} /> : <Rocket size={14} />}
                                </div>
                            </div>
                            <p className="text-[9px] text-slate-400 ml-1">
                                A chave é salva localmente e enviada ao servidor apenas para configuração da sessão.
                            </p>
                        </div>
                    </div>

                    <div className="card-premium p-8 space-y-6 bg-white border-none shadow-xl rounded-[32px]">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm"><User size={24} /></div>
                          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Persona IA</h3>
                        </div>
                        <div className="space-y-4">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2 ml-1">System Instruction (Persona)</label>
                            <textarea className="input-premium h-48 text-xs font-semibold leading-relaxed p-6 rounded-[24px] shadow-inner focus:ring-emerald-500/20" value={aiConfig.persona} onChange={e => setAiConfig({...aiConfig, persona: e.target.value})} />
                            <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase px-1">
                              <span>Professional</span>
                              <span>Contextual</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card-premium p-8 bg-gradient-to-br from-rose-600 to-rose-800 border-none text-white flex flex-col md:flex-row items-center justify-between shadow-2xl rounded-[32px] group relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    <div className="flex items-center gap-6 relative z-10 text-center md:text-left">
                        <div className="p-4 bg-white/20 rounded-2xl shadow-xl backdrop-blur-md group-hover:scale-110 transition-transform duration-500"><AlertCircle size={32} strokeWidth={2.5} /></div>
                        <div>
                            <h4 className="text-2xl font-black uppercase tracking-tighter">Danger Zone</h4>
                            <p className="text-rose-100/80 text-[10px] font-bold mt-1 uppercase tracking-widest">Ações Irreversíveis de Sistema</p>
                        </div>
                    </div>
                    <button onClick={async () => { if(confirm("Confirmar limpeza de base órfã?")) { await fetch('/api/cleanup', {method:'POST'}); fetchCompanies(); } }} className="mt-6 md:mt-0 bg-white text-rose-700 px-8 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-rose-50 hover:scale-105 active:scale-95 transition-all relative z-10">Limpar Base Órfã</button>
                </div>

                <div className="flex justify-end pt-4">
                    <button onClick={() => saveAiConfig(aiConfig)} className="btn-primary py-4 px-12 uppercase font-black text-xs tracking-[0.4em] shadow-[0_20px_40px_-12px_rgba(37,99,235,0.4)] rounded-2xl hover:scale-[1.03] active:scale-95 transition-all duration-300">Salvar Todas Alterações</button>
                </div>
            </div>
          )}

          {/* WHATSAPP TAB - COMPLETE AND FIXED */}
          {activeTab === 'whatsapp' && (
            <div className="flex h-full gap-6 animate-fade-in max-w-[1800px] mx-auto">
                {waSession.status !== 'connected' ? (
                   // QR CODE DISPLAY IF NOT CONNECTED
                   <div className="w-full flex flex-col items-center justify-center space-y-8 animate-slide-up">
                      <div className="bg-white p-12 rounded-[40px] shadow-2xl border border-slate-100 text-center relative overflow-hidden max-w-lg w-full">
                          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
                          <h2 className="text-3xl font-black text-slate-800 mb-2 uppercase tracking-tight">Conectar WhatsApp</h2>
                          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-8">Abra o App > Configurações > Aparelhos Conectados</p>
                          
                          <div className="relative inline-block p-4 bg-white rounded-3xl shadow-inner border border-slate-100 mx-auto">
                              {waSession.qrCode ? (
                                  <img src={waSession.qrCode} alt="QR Code" className="w-64 h-64 mix-blend-multiply opacity-90" />
                              ) : (
                                  <div className="w-64 h-64 bg-slate-50 rounded-2xl flex flex-col items-center justify-center animate-pulse gap-4">
                                      <QrCode size={48} className="text-slate-300" />
                                      <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Gerando Sessão...</span>
                                  </div>
                              )}
                              
                              {waSession.qrCode && (
                                <div className="absolute inset-0 border-[4px] border-emerald-500/20 rounded-3xl pointer-events-none"></div>
                              )}
                          </div>

                          <div className="mt-8 flex justify-center gap-2">
                              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                                  <div className={`w-2 h-2 rounded-full ${waSession.status === 'connecting' ? 'bg-amber-400 animate-bounce' : 'bg-slate-300'}`}></div>
                                  Status: {waSession.status.toUpperCase()}
                              </div>
                          </div>
                      </div>
                   </div>
                ) : (
                // EXISTING CHAT UI IF CONNECTED
                <>
                {/* Conversations Sidebar */}
                <div className="w-[400px] card-premium flex flex-col bg-white overflow-hidden border-none shadow-[0_20px_40px_-16px_rgba(0,0,0,0.1)] rounded-[32px]">
                    <div className="p-6 border-b border-slate-50 bg-slate-50/40 flex justify-between items-center">
                        <div>
                          <h3 className="font-black text-slate-800 text-xs uppercase tracking-tighter">Conversas Ativas</h3>
                          <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Live Feed</p>
                        </div>
                        <Badge variant="brand">{chats.length}</Badge>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-50/80">
                        {chats.map(chat => (
                            <div key={chat.id} onClick={() => { setActiveChat(chat.id); fetchMessages(chat.id); }} className={`p-6 flex gap-4 hover:bg-brand-50/20 cursor-pointer transition-all duration-200 relative group ${activeChat === chat.id ? 'bg-brand-50/50 border-r-[4px] border-brand-600' : ''}`}>
                                <div className="w-12 h-12 rounded-[18px] bg-slate-100 flex items-center justify-center font-black text-slate-400 shrink-0 text-lg border-2 border-white shadow-md group-hover:scale-110 transition-transform">
                                    {getInitials(chat.name || '??')}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <p className="font-black text-slate-800 text-[11px] uppercase tracking-tight truncate pr-4 group-hover:text-brand-700 transition-colors">{chat.name || chat.id.replace(/\D/g, '')}</p>
                                        <span className="text-[9px] font-mono font-bold text-slate-400 whitespace-nowrap">{chat.timestamp ? formatTime(chat.timestamp) : ''}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 truncate leading-relaxed font-medium opacity-80">{chat.lastMessage}</p>
                                </div>
                                {chat.unreadCount > 0 && <div className="absolute right-6 bottom-6 w-5 h-5 bg-brand-600 rounded-lg flex items-center justify-center text-white text-[9px] font-black shadow-lg shadow-brand-500/40">{chat.unreadCount}</div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat Window */}
                <div className="flex-1 card-premium flex flex-col bg-[#f0f2f5] overflow-hidden relative border-none shadow-[0_20px_40px_-16px_rgba(0,0,0,0.12)] rounded-[32px]">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e71a7b327317d924731d7986c.png')]"></div>
                    
                    {activeChat ? (
                        <>
                            <div className="p-6 bg-white/95 backdrop-blur-3xl border-b border-slate-200/60 flex justify-between items-center z-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center font-black text-white text-lg shadow-lg">
                                        {getInitials(chats.find(c => c.id === activeChat)?.name || '??')}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-slate-900 text-xs uppercase tracking-tight truncate max-w-[300px]">{chats.find(c => c.id === activeChat)?.name || activeChat.replace(/\D/g, '')}</h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>
                                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest opacity-80">
                                                {activeChatCompany ? activeChatCompany.razaoSocial?.substring(0, 30) + '...' : 'Live Chat'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {activeChatCompany && (
                                        <button onClick={() => toggleLeadAI(activeChatCompany.id, activeChatCompany.aiActive)} className={`p-3 rounded-2xl transition-all flex items-center gap-2 ${activeChatCompany.aiActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>
                                            <Bot size={16} />
                                            <span className="text-[9px] font-black uppercase">IA {activeChatCompany.aiActive ? 'Auto' : 'Off'}</span>
                                        </button>
                                    )}
                                    <button className="p-3 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-2xl transition-all"><MoreVertical size={20}/></button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar z-0 flex flex-col">
                                {chatMessages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                        <div className={`max-w-[80%] px-6 py-3 rounded-[24px] text-xs shadow-md relative transition-all ${msg.fromMe ? 'bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-tr-none shadow-brand-500/20' : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/50'}`}>
                                            <p className="leading-relaxed font-semibold pr-6">{msg.body}</p>
                                            <div className={`flex items-center justify-end gap-1 mt-1 ${msg.fromMe ? 'text-brand-100' : 'text-slate-400'}`}>
                                                <span className="text-[8px] font-mono font-bold opacity-60">{formatTime(msg.timestamp)}</span>
                                                {msg.fromMe && <Check size={12} className="opacity-80" strokeWidth={3}/>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 bg-white/95 backdrop-blur-3xl border-t border-slate-200/60 flex items-center gap-4 z-10">
                                <button className="p-2 text-slate-400 hover:text-brand-500 transition-colors"><Smile size={24}/></button>
                                <div className="flex-1 relative">
                                    <input 
                                        className="w-full bg-slate-100/80 border-none rounded-[24px] px-6 py-3.5 text-xs font-bold focus:ring-[4px] focus:ring-brand-500/10 transition-all shadow-inner text-slate-800"
                                        placeholder="Digite aqui sua mensagem ou comando IA..."
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                    />
                                </div>
                                <button onClick={handleSendMessage} className="p-4 bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-[24px] shadow-[0_10px_20px_rgba(59,130,246,0.3)] hover:scale-105 active:scale-95 transition-all">
                                    <Send size={20} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-10 text-center animate-fade-in relative">
                            <div className="w-24 h-24 bg-white rounded-[32px] shadow-[0_12px_24px_rgba(0,0,0,0.1)] flex items-center justify-center text-slate-200 mb-6 border border-slate-50 relative z-10">
                                <MessageCircle size={48} className="opacity-20" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter relative z-10">WhatsApp Engine Ready</h2>
                            <p className="text-[10px] max-w-sm mt-2 font-black uppercase tracking-[0.25em] text-slate-400 relative z-10 opacity-70">Selecione um lead no pool para interagir</p>
                        </div>
                    )}
                </div>
                </>
                )}
            </div>
          )}

          {/* IMPORT TAB */}
          {activeTab === 'import' && (
            <div className="max-w-4xl mx-auto animate-fade-in space-y-8 pb-20">
                <div className="card-premium p-16 text-center border-2 border-dashed border-slate-200/80 hover:border-brand-500/50 transition-all duration-700 bg-white relative overflow-hidden group shadow-2xl shadow-slate-200/50 rounded-[40px]">
                    <div className="absolute top-0 right-0 p-12 opacity-[0.03] -rotate-12 group-hover:rotate-0 group-hover:scale-125 transition-transform duration-1000">
                        <FileSpreadsheet size={200} />
                    </div>
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (!file) return;
                         const fd = new FormData(); fd.append('file', file);
                         fetch('/start-processing', {method: 'POST', body: fd}).then(() => fetchImports());
                    }} />
                    <div className="w-20 h-20 bg-brand-50 text-brand-600 rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-inner group-hover:scale-110 transition-transform duration-500 ring-4 ring-brand-50/50">
                        <Upload size={32} strokeWidth={2.5} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tighter">DATA PIPELINE</h2>
                    <p className="text-slate-500 text-xs max-w-sm mx-auto font-medium leading-relaxed opacity-70">
                      Arraste o PDF da consulta consolidada da SEFAZ. Nosso motor irá processar os metadados e atualizar a base inteligente.
                    </p>
                </div>

                <div className="card-premium overflow-hidden border-none shadow-2xl rounded-[32px]">
                    <div className="bg-[#0f172a] px-8 py-5 flex justify-between items-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-brand-600 opacity-5 pointer-events-none"></div>
                        <h3 className="font-black text-white text-[9px] uppercase tracking-[0.3em] relative z-10 flex items-center gap-2">
                           <Activity size={12} className="text-brand-500" /> Extracted Batches
                        </h3>
                        <div className="flex items-center gap-4 relative z-10">
                          <Badge variant="brand">High Volume Ready</Badge>
                        </div>
                    </div>
                    <div className="divide-y divide-slate-100 bg-white">
                        {imports.length === 0 && (
                          <div className="p-16 text-center space-y-3">
                            <Rocket size={32} className="mx-auto text-slate-200" />
                            <p className="text-xs font-bold text-slate-400 italic">Nenhuma importação pendente.</p>
                          </div>
                        )}
                        {imports.map(imp => (
                            <div key={imp.id} className="px-8 py-6 flex items-center justify-between hover:bg-slate-50/80 transition-all duration-300 group">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-slate-300 shadow-sm group-hover:text-brand-600 group-hover:border-brand-200 transition-all">
                                        <FileSpreadsheet size={24} strokeWidth={1.5} />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-black text-slate-800 uppercase text-xs tracking-tight group-hover:text-brand-700 transition-colors">{imp.filename}</p>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1">
                                              <Activity size={8} className="text-slate-400" />
                                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{new Date(imp.date).toLocaleDateString()}</span>
                                            </div>
                                            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                                            <span className="text-[9px] text-brand-500 font-black uppercase tracking-widest">{imp.total} REGISTROS EXTRAÍDOS</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <Badge variant={imp.status === 'completed' ? 'success' : 'warning'}>{imp.status.toUpperCase()}</Badge>
                                    <button onClick={() => deleteImport(imp.id)} className="p-3 text-slate-300 hover:text-rose-500 transition-all rounded-xl hover:bg-rose-50 shadow-sm active:scale-90">
                                      <Trash2 size={18}/>
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