

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Upload, MessageCircle, Bot, Settings, Menu, FileSpreadsheet, Search,
  CheckCircle2, AlertCircle, Send, RefreshCw, BookOpen, Plus, Trash2,
  User, X, Save, Rocket, CheckSquare, Square, Trello, Edit, Power, Phone,
  MoreVertical, Smile, Paperclip as PaperclipIcon, Check, Eye, EyeOff, Cpu, Terminal,
  Filter, BarChart3, PieChart as PieChartIcon, Activity, Mic, ChevronRight, Globe, ShieldCheck, Zap
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, AreaChart, Area
} from 'recharts';
import { CompanyResult, Status, CampaignStatus, KnowledgeRule, AIConfig, WhatsAppSession, ImportBatch, Instruction } from './types';
import { DEFAULT_KNOWLEDGE_RULES, DEFAULT_AI_PERSONA } from './constants';
import { v4 as uuidv4 } from 'uuid';

// --- Custom Hooks (Maintained Lógica original) ---

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
    return text.split('Endereço de Correspondência')[0].split('Endereço:')[0].trim();
};

const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getInitials = (name: string) => {
    return name
        .split(' ')
        .filter(n => n.length > 0)
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};

// --- Premium Subcomponents ---

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: string }) => {
  const styles: Record<string, string> = {
    default: 'bg-slate-100 text-slate-600 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
    warning: 'bg-amber-50 text-amber-700 border-amber-200/50',
    danger: 'bg-rose-50 text-rose-700 border-rose-200/50',
    brand: 'bg-brand-50 text-brand-700 border-brand-200/50',
    info: 'bg-sky-50 text-sky-700 border-sky-200/50',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${styles[variant] || styles.default} backdrop-blur-sm`}>
      {children}
    </span>
  );
};

const SystemLogTerminal = ({ logs }: { logs: any[] }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [logs]);

    const getLogIcon = (level: string) => {
      switch(level) {
        case 'error': return <AlertCircle size={12} className="text-rose-500" />;
        case 'success': return <CheckCircle2 size={12} className="text-emerald-500" />;
        case 'ai': return <Bot size={12} className="text-brand-400" />;
        case 'message': return <MessageCircle size={12} className="text-sky-400" />;
        default: return <Activity size={12} className="text-slate-500" />;
      }
    };

    return (
        <div className="card-premium bg-[#0a0f1d] border-slate-800 flex flex-col h-full overflow-hidden shadow-2xl group ring-1 ring-white/5">
            <div className="bg-[#111827] px-5 py-3.5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                    </div>
                    <h3 className="text-[10px] font-mono font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] ml-2">
                        <Terminal size={14} className="text-brand-500" /> Kernel Activity
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[9px] font-mono text-emerald-500/60 font-bold uppercase">Live</span>
                </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 font-mono text-[11px] space-y-2.5 custom-scrollbar bg-black/40">
                {logs.length === 0 && (
                  <div className="flex items-center gap-2 text-slate-700 italic">
                    <RefreshCw size={12} className="animate-spin" />
                    Aguardando sincronização do servidor...
                  </div>
                )}
                {logs.slice().reverse().map((log) => (
                    <div key={log.id} className="flex gap-4 border-l border-white/5 pl-4 py-1.5 group/line hover:bg-white/[0.02] transition-colors">
                        <span className="text-slate-600 shrink-0 tabular-nums font-medium">{new Date(log.timestamp).toLocaleTimeString([], {hour12:false})}</span>
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <span className="shrink-0 mt-0.5">{getLogIcon(log.level)}</span>
                            <span className={`break-words leading-relaxed ${
                                log.level === 'error' ? 'text-rose-400 font-semibold' : 
                                log.level === 'success' ? 'text-emerald-400' :
                                log.level === 'ai' ? 'text-brand-300' :
                                log.level === 'message' ? 'text-sky-300' : 'text-slate-300'
                            }`}>
                                <span className="opacity-30 mr-1.5">[{log.level.toUpperCase()}]</span>
                                {log.message}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, string> = {
        'pending': 'bg-slate-100 text-slate-600 border-slate-200/50',
        'queued': 'bg-amber-100 text-amber-700 border-amber-200/50',
        'sent': 'bg-sky-100 text-sky-700 border-sky-200/50',
        'replied': 'bg-purple-100 text-purple-700 border-purple-200/50',
        'interested': 'bg-emerald-100 text-emerald-700 border-emerald-200/50',
        'not_interested': 'bg-rose-100 text-rose-700 border-rose-200/50',
        'error': 'bg-red-50 text-red-700 border-red-200/50',
        'skipped': 'bg-slate-200 text-slate-500 border-slate-300/50'
    };
    const labels: Record<string, string> = {
        'pending': 'Pendente',
        'queued': 'Fila',
        'sent': 'Enviado',
        'replied': 'Respondeu',
        'interested': 'Quente',
        'not_interested': 'Perdido',
        'error': 'Erro',
        'skipped': 'Sem Zap'
    };
    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${map[status] || map['pending']}`}>
            {labels[status] || status}
        </span>
    );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data States
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [waSession, setWaSession] = useState<WhatsAppSession>({ status: 'disconnected' });
  const [filters, setFilters] = useState({ search: '', city: 'Todos', reason: 'Todos', waStatus: 'Todos' });
  const [uniqueFilters, setUniqueFilters] = useState({ municipios: [] as string[], motivos: [] as string[] });

  // UI State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  
  // WhatsApp Tab State
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // AI & Knowledge
  // Fix for line 212: Add missing apiKeys property to align with AIConfig interface
  const [aiConfig, setAiConfig] = useLocalStorage<AIConfig>('crm_ai_config', {
    model: 'gemini-3-flash-preview',
    provider: 'gemini',
    apiKeys: { gemini: '', groq: '' },
    persona: DEFAULT_AI_PERSONA,
    knowledgeRules: DEFAULT_KNOWLEDGE_RULES,
    temperature: 0.7,
    aiActive: true
  });
  const [editingRule, setEditingRule] = useState<KnowledgeRule | null>(null);

  // --- Logic original mantida conforme solicitado ---

  const fetchData = async () => {
    try {
      const [comp, conf, imp, filtersRes] = await Promise.all([
        fetch('/get-all-results'),
        fetch('/api/config'),
        fetch('/get-imports'),
        fetch('/api/unique-filters')
      ]);
      if (comp.ok) setCompanies(await comp.json());
      if (conf.ok) {
          const configFromServer = await conf.json();
          setAiConfig(prev => ({ ...prev, ...configFromServer }));
      }
      if (imp.ok) setImports(await imp.json());
      if (filtersRes.ok) setUniqueFilters(await filtersRes.json());
    } catch (e) {}
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/system-logs');
      if (res.ok) setSystemLogs(await res.json());
    } catch (e) {}
  };

  const fetchWaStatus = async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      if (res.ok) setWaSession(await res.json());
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
    const int = setInterval(() => {
      fetchLogs();
      fetchWaStatus();
    }, 3000);
    return () => clearInterval(int);
  }, []);

  useInterval(() => {
    if (activeTab === 'whatsapp' && waSession.status === 'connected') {
        fetch('/api/whatsapp/chats').then(r => r.json()).then(setChats);
        if (activeChat) {
            fetch(`/api/whatsapp/messages/${activeChat}`).then(r => r.json()).then(setChatMessages);
        }
    }
  }, activeTab === 'whatsapp' ? 3000 : null);

  const saveAiConfig = async (newConfig: AIConfig) => {
      try {
          const res = await fetch('/api/config/ai-rules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newConfig)
          });
          if (res.ok) setAiConfig(newConfig);
      } catch (e) { alert('Erro ao salvar config'); }
  };

  const handleSendMessage = async () => {
    if (!activeChat || !newMessage.trim()) return;
    try {
        const res = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: activeChat, message: newMessage })
        });
        if (res.ok) {
            setChatMessages(prev => [...prev, { id: uuidv4(), body: newMessage, fromMe: true, timestamp: Date.now()/1000 }]);
            setNewMessage('');
        }
    } catch (e) {}
  };

  const toggleLeadAI = async (id: string, current: boolean) => {
    try {
        const res = await fetch('/api/leads/toggle-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, active: !current })
        });
        if (res.ok) setCompanies(prev => prev.map(c => c.id === id ? { ...c, aiActive: !current } : c));
    } catch (e) {}
  };

  const deleteImport = async (id: string) => {
      if(!confirm("Deseja apagar esta importação e todos os seus leads?")) return;
      try {
          const res = await fetch(`/api/imports/${id}`, { method: 'DELETE' });
          if(res.ok) fetchData();
      } catch (e) {}
  };

  const filteredCompanies = useMemo(() => {
      return companies.filter(c => {
          const matchSearch = c.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) || c.cnpj.includes(searchTerm);
          const matchCity = filters.city === 'Todos' || c.municipio === filters.city;
          const matchReason = filters.reason === 'Todos' || c.motivoSituacao === filters.reason;
          const matchWA = filters.waStatus === 'Todos' || c.campaignStatus === filters.waStatus;
          return matchSearch && matchCity && matchReason && matchWA;
      });
  }, [companies, searchTerm, filters]);

  const dashboardStats = useMemo(() => {
    const total = companies.length;
    const inaptas = companies.filter(c => !c.situacaoCadastral.includes('ATIVA')).length;
    const graf = [
        { name: 'Pendente', value: companies.filter(c => c.campaignStatus === 'pending').length },
        { name: 'Enviado', value: companies.filter(c => c.campaignStatus === 'sent').length },
        { name: 'Respondeu', value: companies.filter(c => c.campaignStatus === 'replied').length },
        { name: 'Interesse', value: companies.filter(c => c.campaignStatus === 'interested').length },
    ];
    return { total, inaptas, graf };
  }, [companies]);

  // --- Rendering UI ---

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans selection:bg-brand-100 selection:text-brand-900">
      
      {/* Premium Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-24'} bg-[#0f172a] text-white transition-all duration-500 ease-in-out flex flex-col z-30 shadow-[4px_0_24px_rgba(0,0,0,0.15)] relative`}>
        <div className="p-8 border-b border-white/5 flex items-center justify-between overflow-hidden">
          {isSidebarOpen ? (
            <div className="flex items-center gap-4 animate-fade-in">
              <div className="w-11 h-11 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center shadow-[0_8px_16px_rgba(59,130,246,0.3)] ring-1 ring-white/20">
                <Rocket className="text-white" size={24} />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-xl tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">VIRGULA</h2>
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
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', desc: 'Métricas em Tempo Real' },
            { id: 'kanban', icon: Trello, label: 'Kanban', desc: 'Funil de Vendas' },
            { id: 'import', icon: Upload, label: 'Importar PDF', desc: 'Extração SEFAZ' },
            { id: 'leads', icon: FileSpreadsheet, label: 'Gestão de Leads', desc: 'Base de Empresas' },
            { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', desc: 'Atendimento Ativo', badge: waSession.status === 'connected' ? 'On' : 'Off' },
            { id: 'knowledge', icon: BookOpen, label: 'Base de IA', desc: 'Regras Jurídicas' },
            { id: 'settings', icon: Settings, label: 'Configurações', desc: 'API e Persona' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full group flex items-center gap-4 px-4 py-4 rounded-2xl transition-all duration-300 relative ${
                activeTab === item.id 
                  ? 'bg-brand-600 text-white shadow-[0_12px_24px_-8px_rgba(37,99,235,0.4)] scale-[1.02] ring-1 ring-white/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className={`shrink-0 transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
              </div>
              {isSidebarOpen && (
                  <div className="flex-1 flex flex-col text-left overflow-hidden">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm truncate">{item.label}</span>
                        {item.badge && (
                          <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-black ring-1 ${item.badge === 'On' ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30' : 'bg-slate-700/50 text-slate-400 ring-slate-600/30'}`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span className={`text-[9px] font-medium opacity-50 truncate ${activeTab === item.id ? 'text-brand-100' : 'text-slate-500'}`}>{item.desc}</span>
                  </div>
              )}
              {activeTab === item.id && (
                <div className="absolute right-0 w-1 h-6 bg-white rounded-l-full shadow-[0_0_12px_white]"></div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5 bg-black/20">
            <div className={`flex items-center gap-4 ${!isSidebarOpen && 'justify-center'}`}>
                <div className="relative group">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 overflow-hidden shadow-lg group-hover:border-brand-500 transition-colors">
                        <User size={24} />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-[3px] border-[#0f172a] shadow-sm"></div>
                </div>
                {isSidebarOpen && (
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">Admin Master</p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Premium Access</p>
                    </div>
                )}
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Dynamic Header */}
        <header className="h-20 bg-white/70 backdrop-blur-2xl border-b border-slate-200/60 px-10 flex items-center justify-between sticky top-0 z-20 shadow-[0_1px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-8">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 hover:bg-slate-100 rounded-2xl text-slate-500 transition-all active:scale-90">
              <Menu size={22} />
            </button>
            <div className="h-8 w-px bg-slate-200"></div>
            <div>
              <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">
                {activeTab === 'dashboard' ? 'Overview Geral' : 
                 activeTab === 'kanban' ? 'Funil de Vendas' :
                 activeTab === 'import' ? 'Data Extraction' :
                 activeTab === 'leads' ? 'Base Master SEFAZ' :
                 activeTab === 'whatsapp' ? 'Live Chat Agent' :
                 activeTab === 'knowledge' ? 'Kernel Jurídico' : 'Ajustes de Sistema'}
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                <Globe size={10} className="text-brand-500" /> Bahia / Real-time Sync
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
             <div className="hidden lg:flex flex-col items-end mr-4">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Global Status</span>
               <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                  <span className="text-[11px] font-bold text-slate-700">All Systems Normal</span>
               </div>
             </div>

             <button onClick={fetchData} className="p-3.5 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-brand-600 transition-all group">
                <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-700" />
             </button>
             
             <div className="h-10 w-px bg-slate-200"></div>

             <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border shadow-sm transition-all duration-500 ${
               waSession.status === 'connected' 
               ? 'bg-emerald-50 border-emerald-100/50 text-emerald-700' 
               : 'bg-rose-50 border-rose-100/50 text-rose-700'
             }`}>
                <div className={`w-2 h-2 rounded-full ${waSession.status === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'}`}></div>
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">WhatsApp: {waSession.status.toUpperCase()}</span>
             </div>
          </div>
        </header>

        {/* Dynamic Content Main */}
        <main className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-50/40">
          
          {/* TAB: DASHBOARD INTEGRADO */}
          {activeTab === 'dashboard' && (
            <div className="space-y-10 animate-fade-in max-w-[1600px] mx-auto pb-20">
              
              {/* KPIs com Cards Estilizados */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                  { label: 'Base de Dados', value: dashboardStats.total, icon: FileSpreadsheet, color: 'text-brand-600', bg: 'bg-brand-50', trend: '+12%' },
                  { label: 'Inaptas / Suspensas', value: dashboardStats.inaptas, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', trend: 'High Priority' },
                  { label: 'Sessão WhatsApp', value: waSession.status === 'connected' ? 'ONLINE' : 'OFFLINE', icon: MessageCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: 'Encrypted' },
                  { label: 'Inteligência IA', value: aiConfig.aiActive ? 'HABILITADA' : 'INATIVA', icon: Bot, color: 'text-brand-500', bg: 'bg-brand-50', trend: 'Active' },
                ].map((stat, i) => (
                  <div key={i} className="card-premium p-8 group card-hover border-none relative overflow-hidden">
                    <div className={`absolute top-0 right-0 p-8 ${stat.color} opacity-[0.03] group-hover:scale-125 group-hover:rotate-12 transition-transform duration-700`}>
                      <stat.icon size={120} />
                    </div>
                    <div className="flex items-center justify-between mb-6 relative z-10">
                        <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 shadow-sm ring-1 ring-white/20`}>
                            <stat.icon size={26} strokeWidth={2.5} />
                        </div>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100/50 px-2.5 py-1 rounded-lg border border-slate-200/50">{stat.trend}</span>
                    </div>
                    <h3 className="text-4xl font-black text-slate-900 tracking-tight mb-2 relative z-10 tabular-nums">{stat.value}</h3>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] relative z-10">{stat.label}</p>
                    <div className="mt-6 h-1 w-full bg-slate-100 rounded-full overflow-hidden relative z-10">
                      <div className={`h-full ${stat.color.replace('text', 'bg')} w-2/3 rounded-full opacity-60`}></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grid Principal: Gráfico + Terminal */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-1 h-[600px] animate-slide-up">
                    <SystemLogTerminal logs={systemLogs} />
                </div>
                <div className="lg:col-span-2 space-y-10">
                    <div className="card-premium p-10 h-[400px] flex flex-col group border-none shadow-xl animate-fade-in">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                                <BarChart3 size={22} className="text-brand-500" /> Fluxo de Atendimento
                              </h3>
                              <p className="text-xs font-medium text-slate-400 mt-1">Status de conversão por etapa do funil</p>
                            </div>
                            <div className="flex gap-2">
                              <button className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-brand-50 hover:text-brand-600 transition-all"><BarChart3 size={18}/></button>
                              <button className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-brand-50 hover:text-brand-600 transition-all"><PieChartIcon size={18}/></button>
                            </div>
                        </div>
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={dashboardStats.graf}>
                                    <defs>
                                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize:10, fontWeight:800, fill:'#94a3b8'}} dy={15} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize:10, fontWeight:800, fill:'#94a3b8'}} />
                                    <Tooltip 
                                      contentStyle={{borderRadius:'20px', border:'none', boxShadow:'0 20px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold'}}
                                      cursor={{stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '4 4'}}
                                    />
                                    <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorValue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Conexão Rápida WhatsApp */}
                        <div className="card-premium p-8 bg-gradient-to-br from-brand-600 to-brand-800 border-none text-white relative overflow-hidden group">
                           <Zap size={100} className="absolute -bottom-4 -right-4 text-white/10 group-hover:scale-125 transition-transform duration-1000 rotate-12" />
                           <h4 className="text-sm font-black uppercase tracking-[0.2em] mb-3 opacity-80">Conectividade Zap</h4>
                           <h3 className="text-2xl font-black mb-6 leading-tight">Mantenha sua IA <br/>sempre em operação.</h3>
                           <button onClick={() => setActiveTab('whatsapp')} className="bg-white text-brand-700 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-black/20 hover:scale-105 active:scale-95 transition-all">
                             Check Terminal
                           </button>
                        </div>

                        {/* Top Regiões */}
                        <div className="card-premium p-8 flex flex-col border-none shadow-lg">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Frequência por Região</h4>
                           <div className="space-y-4">
                              {[
                                { name: 'Salvador', perc: 45 },
                                { name: 'Feira de Santana', perc: 22 },
                                { name: 'Camaçari', perc: 18 },
                              ].map((reg, idx) => (
                                <div key={idx} className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{reg.name}</span>
                                    <span className="text-[10px] font-black text-slate-500">{reg.perc}%</span>
                                  </div>
                                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-500 rounded-full opacity-60" style={{ width: `${reg.perc}%` }}></div>
                                  </div>
                                </div>
                              ))}
                           </div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: KANBAN FLOW */}
          {activeTab === 'kanban' && (
            <div className="h-full flex gap-10 overflow-x-auto pb-10 animate-fade-in custom-scrollbar">
                {['pending', 'sent', 'replied', 'interested'].map((status, idx) => (
                    <div key={status} className="w-[340px] shrink-0 flex flex-col h-full bg-slate-200/30 rounded-[40px] border border-slate-200/50 p-6 shadow-inner animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                        <div className="flex justify-between items-center mb-8 px-4">
                            <h3 className="font-black text-slate-700 uppercase text-xs tracking-[0.25em] flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${status === 'pending' ? 'bg-slate-400' : status === 'sent' ? 'bg-sky-400' : status === 'replied' ? 'bg-purple-500' : 'bg-emerald-500'}`}></div>
                                {status === 'pending' ? 'Prospecção' : status === 'sent' ? 'Contatados' : status === 'replied' ? 'Engajamento' : 'Oportunidades'}
                            </h3>
                            <span className="bg-white/80 backdrop-blur-md px-3 py-1 rounded-xl text-[10px] font-black text-slate-500 border border-slate-200/50 shadow-sm tabular-nums">
                                {companies.filter(c => c.campaignStatus === status).length}
                            </span>
                        </div>
                        <div className="flex-1 space-y-6 overflow-y-auto custom-scrollbar pr-1">
                            {companies.filter(c => c.campaignStatus === status).length === 0 && (
                                <div className="py-20 text-center text-slate-300 opacity-50 flex flex-col items-center gap-4">
                                    <Activity size={40} strokeWidth={1}/>
                                    <p className="text-[10px] font-black uppercase tracking-widest">Sem leads nesta fase</p>
                                </div>
                            )}
                            {companies.filter(c => c.campaignStatus === status).map(lead => (
                                <div key={lead.id} onClick={() => { setActiveTab('whatsapp'); setActiveChat(lead.wa_id || lead.telefone + '@c.us'); }} className="card-premium p-6 shadow-sm hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:border-brand-300 cursor-pointer transition-all duration-500 bg-white group border-b-[6px] border-b-slate-100/50 hover:border-b-brand-500 ring-1 ring-slate-100">
                                    <div className="flex justify-between items-start mb-4">
                                        <Badge variant={lead.situacaoCadastral.includes('ATIVA') ? 'success' : 'danger'}>{lead.situacaoCadastral}</Badge>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                                            <button className="p-2 bg-brand-50 text-brand-600 rounded-lg hover:bg-brand-500 hover:text-white transition-colors"><MessageCircle size={14}/></button>
                                        </div>
                                    </div>
                                    <h4 className="font-black text-slate-800 text-xs mb-1.5 line-clamp-2 uppercase tracking-tight leading-[1.6] group-hover:text-brand-700 transition-colors">{lead.razaoSocial}</h4>
                                    <p className="text-[9px] text-slate-400 font-mono mb-6 flex items-center gap-1.5">
                                      <ShieldCheck size={10} className="text-slate-300" /> {lead.cnpj}
                                    </p>
                                    <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-2 h-2 rounded-full ${lead.aiActive ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-300'}`}></div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Agent {lead.aiActive ? 'Active' : 'Standby'}</span>
                                        </div>
                                        <div className="p-1.5 bg-slate-50 rounded-lg text-slate-300 group-hover:bg-brand-50 group-hover:text-brand-500 transition-all">
                                          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
          )}

          {/* TAB: IMPORT SYSTEM */}
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
                         fetch('/start-processing', {method: 'POST', body: fd}).then(() => fetchData());
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

          {/* TAB: LEADS MANAGEMENT */}
          {activeTab === 'leads' && (
            <div className="space-y-8 animate-fade-in max-w-[1700px] mx-auto pb-24">
                <div className="card-premium p-8 flex flex-col xl:flex-row gap-8 items-center justify-between bg-white border-none shadow-xl rounded-[32px]">
                    <div className="flex-1 relative group w-full">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-500 transition-colors duration-300" size={22} />
                        <input 
                            type="text" 
                            className="w-full pl-16 pr-8 py-5 bg-slate-50 border-none rounded-[24px] text-sm font-bold focus:ring-[6px] focus:ring-brand-500/10 transition-all placeholder:text-slate-300 shadow-inner"
                            placeholder="Consultar por Razão Social, CNPJ ou Inscrição..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-4 w-full xl:w-auto overflow-x-auto pb-4 xl:pb-0 custom-scrollbar">
                         <div className="relative">
                            <select className="appearance-none bg-slate-50 border-none rounded-2xl pl-6 pr-12 py-4 text-[11px] font-black uppercase text-slate-600 focus:ring-4 focus:ring-brand-500/10 cursor-pointer shadow-sm min-w-[180px]"
                              value={filters.city} onChange={e => setFilters({...filters, city: e.target.value})}>
                                <option value="Todos">Município</option>
                                {uniqueFilters.municipios.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <ChevronRight size={14} className="absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
                         </div>

                         <div className="relative">
                            <select className="appearance-none bg-slate-50 border-none rounded-2xl pl-6 pr-12 py-4 text-[11px] font-black uppercase text-slate-600 focus:ring-4 focus:ring-brand-500/10 cursor-pointer shadow-sm min-w-[180px]"
                              value={filters.waStatus} onChange={e => setFilters({...filters, waStatus: e.target.value})}>
                                <option value="Todos">Status Funil</option>
                                <option value="pending">Pendente</option>
                                <option value="sent">Enviado</option>
                                <option value="replied">Respondeu</option>
                                <option value="interested">Oportunidade</option>
                            </select>
                            <ChevronRight size={14} className="absolute right-5 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
                         </div>

                         <button onClick={() => setSelectedIds(new Set(filteredCompanies.map(c => c.id)))} className="px-8 py-4 bg-brand-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-brand-500/30 hover:bg-brand-700 hover:-translate-y-0.5 transition-all whitespace-nowrap active:scale-95">
                           Global Select
                         </button>
                    </div>
                </div>

                <div className="card-premium overflow-hidden border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] rounded-[32px]">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80 border-b border-slate-100/50">
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Entidade / Fiscal</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Estágio Funil</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Motivo SEFAZ</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-center">Protocolo IA</th>
                                    <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] text-right">Interação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 bg-white">
                                {filteredCompanies.length === 0 && (
                                    <tr><td colSpan={5} className="p-32 text-center">
                                      <div className="flex flex-col items-center gap-6 opacity-30">
                                        <Search size={64} />
                                        <p className="font-black uppercase tracking-widest text-sm italic">Query sem resultados na base atual.</p>
                                      </div>
                                    </td></tr>
                                )}
                                {filteredCompanies.map(lead => (
                                    <tr key={lead.id} className="group hover:bg-brand-50/30 transition-all duration-300 cursor-default">
                                        <td className="px-10 py-6">
                                            <div className="flex items-center gap-6">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-brand-600 group-hover:text-white group-hover:scale-105 group-hover:rotate-3 transition-all duration-300 shadow-sm border border-slate-200/50">
                                                    {lead.razaoSocial.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-slate-800 text-xs uppercase tracking-tight leading-none group-hover:text-brand-800 transition-colors truncate max-w-[300px]">{lead.razaoSocial}</p>
                                                    <div className="flex items-center gap-2.5 mt-2">
                                                        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-1.5 rounded tracking-tighter">{lead.cnpj}</span>
                                                        <Badge variant={lead.situacaoCadastral.includes('ATIVA') ? 'success' : 'danger'}>{lead.situacaoCadastral}</Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6"><StatusBadge status={lead.campaignStatus} /></td>
                                        <td className="px-10 py-6 max-w-[350px]">
                                            <p className="text-[11px] text-slate-500 font-medium italic line-clamp-2 leading-relaxed opacity-70 group-hover:opacity-100 transition-opacity">
                                              "{cleanReasonText(lead.motivoSituacao) || 'Não especificado'}"
                                            </p>
                                        </td>
                                        <td className="px-10 py-6 text-center">
                                            <div className="flex flex-col items-center gap-1.5">
                                              <button 
                                                  onClick={() => toggleLeadAI(lead.id, !!lead.aiActive)}
                                                  className={`relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-500 focus:outline-none shadow-sm ${lead.aiActive ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                              >
                                                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xl ring-0 transition-transform duration-500 ease-spring ${lead.aiActive ? 'translate-x-6' : 'translate-x-0'}`} />
                                              </button>
                                              <span className={`text-[8px] font-black uppercase tracking-widest ${lead.aiActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                {lead.aiActive ? 'Active' : 'Standby'}
                                              </span>
                                            </div>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <button 
                                              onClick={() => { setActiveTab('whatsapp'); setActiveChat(lead.wa_id || lead.telefone + '@c.us'); }} 
                                              className="p-4 bg-brand-50 text-brand-600 rounded-2xl hover:bg-brand-600 hover:text-white transition-all duration-300 shadow-sm active:scale-90"
                                            >
                                                <MessageCircle size={20} strokeWidth={2.5} />
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

          {/* TAB: WHATSAPP AGENT */}
          {activeTab === 'whatsapp' && (
            <div className="flex h-full gap-10 animate-fade-in max-w-[1800px] mx-auto pb-6">
                
                {/* Conversations Sidebar */}
                <div className="w-[480px] card-premium flex flex-col bg-white overflow-hidden border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] rounded-[40px]">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/40 flex justify-between items-center">
                        <div>
                          <h3 className="font-black text-slate-800 text-sm uppercase tracking-tighter">Live Conversation Pool</h3>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Sincronizado com Baileys Core</p>
                        </div>
                        <Badge variant="brand">{chats.length}</Badge>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-50/80">
                        {chats.length === 0 && (
                          <div className="p-20 text-center opacity-30 space-y-4">
                            <RefreshCw size={48} className="mx-auto animate-spin" />
                            <p className="text-xs font-black uppercase tracking-widest">Aguardando Handshake...</p>
                          </div>
                        )}
                        {chats.map(chat => (
                            <div 
                                key={chat.id} 
                                onClick={() => setActiveChat(chat.id)}
                                className={`p-8 flex gap-6 hover:bg-brand-50/20 cursor-pointer transition-all duration-300 relative group ${activeChat === chat.id ? 'bg-brand-50/50 border-r-[6px] border-brand-600' : ''}`}
                            >
                                <div className="w-16 h-16 rounded-[24px] bg-slate-100 flex items-center justify-center font-black text-slate-400 shrink-0 text-2xl border-2 border-white shadow-md group-hover:scale-110 transition-transform duration-500">
                                    {chat.name?.charAt(0) || 'U'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-baseline mb-2">
                                        <p className="font-black text-slate-800 text-xs uppercase tracking-tight truncate pr-6 group-hover:text-brand-700 transition-colors">{chat.name || chat.id.split('@')[0]}</p>
                                        <span className="text-[10px] font-mono font-bold text-slate-400 whitespace-nowrap">{chat.timestamp ? formatTime(chat.timestamp) : ''}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate leading-relaxed font-medium opacity-80">{chat.lastMessage || 'Sem conteúdo de prévia'}</p>
                                </div>
                                {chat.unreadCount > 0 && (
                                  <div className="absolute right-8 bottom-8 w-6 h-6 bg-brand-600 rounded-xl flex items-center justify-center text-white text-[10px] font-black shadow-lg shadow-brand-500/40">
                                    {chat.unreadCount}
                                  </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat Engine Window */}
                <div className="flex-1 card-premium flex flex-col bg-[#f0f2f5] overflow-hidden relative border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] rounded-[40px]">
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e71a7b327317d924731d7986c.png')] bg-repeat"></div>
                    
                    {activeChat ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-8 bg-white/95 backdrop-blur-3xl border-b border-slate-200/60 flex justify-between items-center z-10 shadow-sm">
                                <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center font-black text-white text-2xl shadow-xl shadow-brand-500/20 ring-2 ring-white/50">
                                        {chats.find(c => c.id === activeChat)?.name?.charAt(0) || activeChat.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight truncate max-w-[300px]">{chats.find(c => c.id === activeChat)?.name || activeChat}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>
                                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest opacity-80">Syncing Pipeline</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button className="p-4 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-[20px] transition-all active:scale-90"><Phone size={24}/></button>
                                    <button className="p-4 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-[20px] transition-all active:scale-90"><MoreVertical size={24}/></button>
                                </div>
                            </div>

                            {/* Messages Scroll Area */}
                            <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar z-0 flex flex-col">
                                {chatMessages.length === 0 && (
                                  <div className="my-auto text-center space-y-4 opacity-20">
                                    <Terminal size={64} className="mx-auto" />
                                    <p className="text-sm font-black uppercase tracking-widest">Handshaking chat history...</p>
                                  </div>
                                )}
                                {chatMessages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                                        <div className={`max-w-[80%] px-8 py-5 rounded-[32px] text-sm shadow-xl relative transition-all hover:scale-[1.01] ${
                                          msg.fromMe 
                                          ? 'bg-gradient-to-br from-brand-600 to-brand-700 text-white rounded-tr-none ring-1 ring-white/20' 
                                          : 'bg-white text-slate-800 rounded-tl-none border border-slate-200/50'
                                        }`}>
                                            <p className="leading-relaxed font-semibold text-[13px]">{msg.body}</p>
                                            <div className={`flex items-center justify-end gap-2 mt-3 ${msg.fromMe ? 'text-brand-100' : 'text-slate-400'}`}>
                                                <span className="text-[10px] font-mono font-bold opacity-60">{new Date(msg.timestamp*1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                {msg.fromMe && <Check size={14} className="opacity-80" strokeWidth={3}/>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Input Container */}
                            <div className="p-8 bg-white/95 backdrop-blur-3xl border-t border-slate-200/60 flex items-center gap-6 z-10 shadow-inner">
                                <div className="flex gap-1">
                                    <button className="p-4 text-slate-400 hover:text-brand-500 transition-colors hover:bg-slate-50 rounded-2xl"><Smile size={28}/></button>
                                    <button className="p-4 text-slate-400 hover:text-brand-500 transition-colors hover:bg-slate-50 rounded-2xl"><PaperclipIcon size={26}/></button>
                                </div>
                                <div className="flex-1 relative">
                                    <input 
                                        className="w-full bg-slate-100/80 border-none rounded-[28px] px-10 py-5 text-sm font-bold focus:ring-[6px] focus:ring-brand-500/10 transition-all shadow-inner text-slate-800"
                                        placeholder="Type your instruction or message..."
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                    />
                                </div>
                                <button onClick={handleSendMessage} className="p-6 bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-[32px] shadow-[0_20px_40px_rgba(59,130,246,0.3)] hover:scale-105 active:scale-95 transition-all duration-300 ring-1 ring-white/20">
                                    <Send size={28} className="translate-x-0.5" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center animate-fade-in relative">
                            <div className="absolute inset-0 bg-gradient-to-b from-slate-100/50 to-transparent"></div>
                            <div className="w-32 h-32 bg-white rounded-[44px] shadow-[0_24px_48px_rgba(0,0,0,0.1)] flex items-center justify-center text-slate-200 mb-10 border border-slate-50 relative z-10">
                                <MessageCircle size={64} className="opacity-20" />
                            </div>
                            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter relative z-10">Agent Command Center</h2>
                            <p className="text-xs max-w-sm mt-4 font-black uppercase tracking-[0.25em] text-slate-400 relative z-10 opacity-70">Selecione um pool para gerir</p>
                            <div className="mt-12 flex gap-4 relative z-10">
                              <Badge variant="brand">Automated Replies Enabled</Badge>
                              <Badge variant="success">Sync Active</Badge>
                            </div>
                        </div>
                    )}
                </div>
            </div>
          )}

          {/* TAB: KNOWLEDGE BASE */}
          {activeTab === 'knowledge' && (
            <div className="max-w-[1500px] mx-auto space-y-12 pb-32 animate-fade-in">
                <div className="flex items-center justify-between bg-white p-12 rounded-[56px] shadow-xl border border-slate-50 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-transparent pointer-events-none"></div>
                    <div className="relative z-10">
                        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2 leading-none">Kernel Inteligente</h2>
                        <p className="text-slate-400 font-black uppercase text-[11px] tracking-[0.3em] opacity-80">Base de Heurística Jurídica e Respostas</p>
                    </div>
                    <button 
                        onClick={() => setEditingRule({ id: uuidv4(), motivoSituacao: '', instructions: [], isActive: true })}
                        className="btn-primary py-5 px-12 shadow-[0_20px_40px_rgba(59,130,246,0.3)] text-xs font-black uppercase tracking-[0.2em] flex items-center gap-4 group-hover:scale-105 transition-all duration-500"
                    >
                        <Plus size={24} strokeWidth={3} /> Inject New Rule
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
                    {aiConfig.knowledgeRules.map((rule, idx) => (
                        <div key={rule.id} className="card-premium p-10 group flex flex-col h-[520px] border-none shadow-xl hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.12)] hover:-translate-y-2 transition-all duration-700 overflow-hidden relative animate-slide-up" style={{ animationDelay: `${idx * 0.1}s` }}>
                            <div className="absolute top-0 right-0 p-12 opacity-[0.03] -rotate-12 group-hover:rotate-0 group-hover:scale-125 transition-transform duration-1000">
                              <BookOpen size={200} />
                            </div>
                            <div className="flex justify-between items-start mb-8 relative z-10">
                                <div className="p-4 bg-brand-50 text-brand-600 rounded-3xl group-hover:bg-brand-600 group-hover:text-white transition-all duration-500 shadow-sm ring-1 ring-brand-100">
                                    <BookOpen size={28} />
                                </div>
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
                                {rule.instructions.length === 0 && (
                                  <p className="text-[11px] text-slate-400 font-bold italic">Sem diretrizes injetadas para este kernel.</p>
                                )}
                                {rule.instructions.map((inst, i) => (
                                    <div key={i} className="p-5 bg-slate-50/80 rounded-3xl border border-slate-100 group-hover:bg-white transition-colors duration-500 shadow-sm">
                                        <p className="text-[12px] text-slate-600 font-semibold italic leading-relaxed tracking-tight">"{inst.content}"</p>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-8 pt-6 border-t border-slate-50 flex items-center justify-between relative z-10">
                               <Badge variant={rule.isActive ? 'success' : 'default'}>{rule.isActive ? 'RULE ENABLED' : 'RULE STANDBY'}</Badge>
                               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{rule.instructions.length} DATA NODES</span>
                            </div>
                        </div>
                    ))}
                </div>

                {editingRule && (
                    <div className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-2xl flex items-center justify-center p-8">
                        <div className="bg-white w-full max-w-3xl rounded-[56px] shadow-2xl flex flex-col max-h-[90vh] animate-slide-up ring-1 ring-white/20">
                            <div className="p-12 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Heuristic Editor</h3>
                                <button onClick={() => setEditingRule(null)} className="p-4 hover:bg-white hover:text-rose-500 rounded-[28px] text-slate-400 transition-all shadow-sm active:scale-90"><X size={32}/></button>
                            </div>
                            <div className="p-12 overflow-y-auto custom-scrollbar space-y-12 flex-1 bg-white">
                                <div className="space-y-4">
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 ml-2">Kernel Identification (SEFAZ ID)</label>
                                    <input className="input-premium font-black text-slate-900 py-5 rounded-[24px] tracking-tight uppercase shadow-inner" placeholder="Ex: Art. 27 - Inaptidão por MEI" value={editingRule.motivoSituacao} onChange={e => setEditingRule({...editingRule, motivoSituacao: e.target.value})} />
                                </div>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center mb-6 ml-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">IA Behavioral Directives</label>
                                        <button onClick={() => setEditingRule({...editingRule, instructions: [...editingRule.instructions, { id: uuidv4(), title: 'Info', type: 'simple', content: '' }]})} className="px-5 py-2 bg-brand-50 text-brand-700 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-600 hover:text-white transition-all shadow-sm">+ Append Directive</button>
                                    </div>
                                    <div className="space-y-6">
                                        {editingRule.instructions.length === 0 && (
                                          <div className="p-12 text-center border-2 border-dashed border-slate-100 rounded-[32px] text-slate-300 font-bold uppercase tracking-widest text-[10px]">Aguardando dados...</div>
                                        )}
                                        {editingRule.instructions.map((inst, i) => (
                                            <div key={i} className="flex gap-5 items-start animate-fade-in group/edit">
                                                <div className="flex-1 relative">
                                                   <textarea className="input-premium flex-1 min-h-[120px] text-sm font-semibold leading-relaxed p-6 rounded-[32px] shadow-sm focus:ring-brand-500/20" value={inst.content} onChange={e => {
                                                        const ni = [...editingRule.instructions]; ni[i].content = e.target.value; setEditingRule({...editingRule, instructions: ni});
                                                    }} placeholder="The AI agent should communicate that..." />
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
                                <button onClick={() => setEditingRule(null)} className="flex-1 py-5 font-black text-xs uppercase text-slate-400 tracking-widest hover:text-slate-600 transition-colors">Abort Changes</button>
                                <button onClick={() => {
                                     const nr = aiConfig.knowledgeRules.filter(r => r.id !== editingRule.id); nr.push(editingRule);
                                     saveAiConfig({...aiConfig, knowledgeRules: nr}); setEditingRule(null);
                                }} className="flex-[2] btn-primary py-5 uppercase font-black text-sm tracking-[0.3em] shadow-2xl shadow-brand-500/30 rounded-[28px]">Commit Rule to Kernel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          )}

          {/* TAB: SYSTEM SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-12 animate-fade-in pb-32">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Provedor Card */}
                    <div className="card-premium p-12 space-y-10 bg-white border-none shadow-2xl rounded-[48px]">
                        <div className="flex items-center gap-5">
                          <div className="p-4 bg-brand-50 text-brand-600 rounded-[24px] shadow-sm"><Cpu size={32} /></div>
                          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">AI Provider</h3>
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
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] leading-relaxed">
                            O CRM VIRGULA utiliza chaves de API injetadas automaticamente via environment. A segurança de ponta a ponta é garantida pelo protocolo de handshake do servidor.
                          </p>
                        </div>
                    </div>

                    {/* Persona Card */}
                    <div className="card-premium p-12 space-y-10 bg-white border-none shadow-2xl rounded-[48px]">
                        <div className="flex items-center gap-5">
                          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-[24px] shadow-sm"><User size={32} /></div>
                          <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">AI Persona</h3>
                        </div>
                        <div className="space-y-6">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4 ml-2">System Instruction (Master Directive)</label>
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
                    <button onClick={() => { if(confirm("Confirmar limpeza completa?")) fetch('/api/cleanup', {method:'POST'}).then(fetchData); }} className="mt-8 md:mt-0 bg-white text-rose-700 px-12 py-5 rounded-[28px] font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl hover:bg-rose-50 hover:scale-105 active:scale-95 transition-all relative z-10">
                      Purge Orphan Data
                    </button>
                </div>

                <div className="flex justify-end pt-8">
                    <button onClick={() => saveAiConfig(aiConfig)} className="btn-primary py-6 px-20 uppercase font-black text-sm tracking-[0.4em] shadow-[0_32px_64px_-12px_rgba(37,99,235,0.4)] rounded-[32px] hover:scale-[1.03] active:scale-95 transition-all duration-500">
                      Commit All Changes
                    </button>
                </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default App;