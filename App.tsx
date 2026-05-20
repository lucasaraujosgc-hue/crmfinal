import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Upload, MessageCircle, Bot, Settings, Menu, FileSpreadsheet, Search,
  CheckCircle2, AlertCircle, Send, RefreshCw, BookOpen, Plus, Trash2,
  User, X, Rocket, Edit,
  Smile, Check, Cpu, Terminal,
  Activity, ArrowLeft, ArrowRight, Play, Clock, ScrollText, QrCode, Calculator
} from 'lucide-react';
import { CompanyResult, Status, KnowledgeRule, AIConfig, WhatsAppSession, ImportBatch } from './types';
import { DEFAULT_AI_PERSONA } from './constants';
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
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    brand: 'bg-brand-50 text-brand-700 border-brand-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${styles[variant] || styles.default}`}>
      {children}
    </span>
  );
};

// Removed StatusBadge as it's not used anymore.

// --- Componentes Funcionais Reutilizáveis ---

// Barra de Filtros Compactada
const FilterBar = ({ filters, setFilters, availableCities, availableReasons, onRefresh, totalResults }: any) => (
    <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-white border border-slate-200 p-4 rounded-lg shadow-sm mb-6">
        <div className="flex-1 relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
                type="text" 
                className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-md text-base focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-400 font-medium"
                placeholder="Filtrar por Razão Social, CNPJ, ou Telefone..."
                value={filters.search}
                onChange={e => setFilters({...filters, search: e.target.value})}
            />
        </div>
        <div className="flex items-center gap-3 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0">
            <select className="border border-slate-200 bg-white rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-brand-500 min-w-[140px]"
                value={filters.city} onChange={e => setFilters({...filters, city: e.target.value})}>
                <option value="">Todas Cidades</option>
                {availableCities.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
            
            <select className="border border-slate-200 bg-white rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-brand-500 min-w-[140px]"
                value={filters.reason} onChange={e => setFilters({...filters, reason: e.target.value})}>
                <option value="">Todos Motivos</option>
                {availableReasons.map((r: string) => <option key={r} value={r}>{r}</option>)}
            </select>

            <select className="border border-slate-200 bg-white rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-brand-500 min-w-[140px]"
                value={filters.statusWa} onChange={e => setFilters({...filters, statusWa: e.target.value})}>
                <option value="all">Status Zap</option>
                <option value="pending">Pendente</option>
                <option value="sent">Enviado</option>
                <option value="replied">Respondido</option>
                <option value="interested">Quente</option>
            </select>
            
            <select className="border border-slate-200 bg-white rounded-md px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-brand-500 min-w-[140px]"
                value={filters.hasAccountant || 'all'} onChange={e => setFilters({...filters, hasAccountant: e.target.value})}>
                <option value="all">Contador?</option>
                <option value="yes">Possui</option>
                <option value="no">Sem Contador</option>
            </select>
            
            {onRefresh && (
                <button onClick={onRefresh} className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 rounded-md transition-colors flex items-center justify-center">
                    <RefreshCw size={16} />
                </button>
            )}
        </div>
        {totalResults !== undefined && (
             <div className="px-3 py-1.5 bg-slate-100 rounded-md font-medium text-slate-600 text-xs whitespace-nowrap">
                 {totalResults} LEADS
             </div>
        )}
    </div>
);

const FilterInput = ({ placeholder, value, onChange }: any) => (
    <div className="mt-1">
        <input 
            type="text" 
            placeholder={placeholder}
            className="w-full px-2 py-1 text-xs border border-slate-200 rounded text-slate-700 font-normal focus:outline-none focus:border-brand-400"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
        />
    </div>
);

// Tabela de Empresas Compactada
const CompanyTable = ({ companies, selectedIds, toggleSelection, toggleSelectAll, selectable = false, onToggleAi, onChat, onViewDetails, colFilters, setColFilters }: any) => {
    
    return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 divide-x divide-slate-100">
                        {selectable && (
                            <th className="px-4 py-3 w-10 text-center align-top">
                                <input 
                                    type="checkbox" 
                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 mt-2"
                                    checked={selectedIds.size > 0 && selectedIds.size === companies.length}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                        )}
                        <th className="px-4 py-2 font-semibold text-slate-600 align-top min-w-[120px]">
                            Inscrição
                            {setColFilters && <FilterInput placeholder="Filtrar..." value={colFilters?.inscricao} onChange={(v: string) => setColFilters({...colFilters, inscricao: v})} />}
                        </th>
                        <th className="px-4 py-2 font-semibold text-slate-600 align-top min-w-[140px]">
                            CNPJ
                            {setColFilters && <FilterInput placeholder="Filtrar..." value={colFilters?.cnpj} onChange={(v: string) => setColFilters({...colFilters, cnpj: v})} />}
                        </th>
                        <th className="px-4 py-2 font-semibold text-slate-600 align-top min-w-[200px]">
                            Razão Social
                            {setColFilters && <FilterInput placeholder="Filtrar..." value={colFilters?.razao} onChange={(v: string) => setColFilters({...colFilters, razao: v})} />}
                        </th>
                        <th className="px-4 py-2 font-semibold text-slate-600 align-top min-w-[140px]">
                            Município
                            {setColFilters && <FilterInput placeholder="Filtrar..." value={colFilters?.municipio} onChange={(v: string) => setColFilters({...colFilters, municipio: v})} />}
                        </th>
                        <th className="px-4 py-2 font-semibold text-slate-600 align-top min-w-[120px]">
                            Situação
                            {setColFilters && <FilterInput placeholder="Filtrar..." value={colFilters?.situacao} onChange={(v: string) => setColFilters({...colFilters, situacao: v})} />}
                        </th>
                        <th className="px-4 py-2 font-semibold text-slate-600 align-top min-w-[140px]">
                            Forma de Pagamento
                            {setColFilters && <FilterInput placeholder="Filtrar..." value={colFilters?.pagamento} onChange={(v: string) => setColFilters({...colFilters, pagamento: v})} />}
                        </th>
                        <th className="px-4 py-2 font-semibold text-slate-600 align-top min-w-[200px]">
                            Motivo da Situação
                            {setColFilters && <FilterInput placeholder="Filtrar..." value={colFilters?.motivo} onChange={(v: string) => setColFilters({...colFilters, motivo: v})} />}
                        </th>
                        {(onChat || onViewDetails || onToggleAi) && <th className="px-4 py-2 font-semibold text-slate-600 align-top w-20"></th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {companies.slice(0, 100).map((lead: CompanyResult) => (
                        <tr key={lead.id} className={`hover:bg-slate-50 transition-colors ${selectedIds?.has(lead.id) ? 'bg-slate-50' : ''}`}>
                            {selectable && (
                                <td className="px-4 py-3 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                                        checked={selectedIds.has(lead.id)}
                                        onChange={() => toggleSelection(lead.id)}
                                    />
                                </td>
                            )}
                            <td className="px-4 py-3 font-mono text-slate-700">{lead.inscricaoEstadual}</td>
                            <td className="px-4 py-3 font-mono text-slate-700">{lead.cnpj}</td>
                            <td className="px-4 py-3">
                                <p className="font-medium text-slate-900 truncate max-w-[200px]" title={lead.razaoSocial}>{lead.razaoSocial}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{lead.municipio}</td>
                            <td className="px-4 py-3">
                                <Badge variant={lead.situacaoCadastral?.includes('ATIVA') ? 'success' : 'danger'}>{lead.situacaoCadastral}</Badge>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{lead.formaPagamento || '-'}</td>
                            <td className="px-4 py-3">
                                <p className="text-xs text-slate-600 line-clamp-2" title={lead.motivoSituacao}>
                                    {cleanReasonText(lead.motivoSituacao) || '-'}
                                </p>
                            </td>
                            {(onChat || onViewDetails || onToggleAi) && (
                                <td className="px-4 py-3 text-right">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-end gap-1">
                                            {onViewDetails && (
                                                <button onClick={() => onViewDetails(lead)} className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Detalhes da Empresa">
                                                    <ScrollText size={16} />
                                                </button>
                                            )}
                                            {onChat && (
                                                <button onClick={() => onChat(lead)} className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Abrir Chat WhatsApp">
                                                    <MessageCircle size={16} />
                                                </button>
                                            )}
                                        </div>
                                        {onToggleAi && (
                                            <div className="flex justify-end mt-1" title="IA Automação">
                                                <button onClick={() => onToggleAi(lead.id, lead.aiActive)} className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${lead.aiActive ? 'bg-brand-600' : 'bg-slate-200'}`}>
                                                    <span className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${lead.aiActive ? 'translate-x-3' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                    {companies.length === 0 && (
                        <tr>
                            <td colSpan={10} className="px-6 py-8 text-center text-slate-500">Nenhum registro encontrado.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    </div>
    );
};

// Card Kanban Compacto
interface KanbanCardProps {
    company: CompanyResult;
    onClick: () => void;
}

const KanbanCard: React.FC<KanbanCardProps> = ({ company, onClick }) => (
    <div onClick={onClick} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 hover:border-brand-400 hover:shadow-md transition-all cursor-pointer mb-3 relative overflow-hidden group">
        <div className="flex justify-between items-start mb-3">
            <h4 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-brand-600 transition-colors pr-6">
                {company.razaoSocial}
            </h4>
            {company.aiActive && (
                <div className="absolute top-4 right-4 text-emerald-500" title="IA Automática Ativa">
                    <Bot size={16} />
                </div>
            )}
        </div>
        
        <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2">
                <Badge variant={company.situacaoCadastral?.includes('ATIVA') ? 'success' : 'danger'}>{company.situacaoCadastral}</Badge>
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2">
                <span className="font-mono">{company.cnpj}</span>
                <span>&bull;</span>
                <span className="truncate">{company.municipio}</span>
            </div>
        </div>

        {company.lastContacted && (
             <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-500">
                 <div className="flex items-center gap-1.5 flex-1">
                     <Clock size={12} />
                     <span className="text-[10px] font-medium uppercase">
                         {new Date(company.lastContacted).toLocaleDateString()}
                     </span>
                 </div>
                 {company.telefone && <MessageCircle size={14} className="text-brand-500" />}
             </div>
        )}
    </div>
);

import { FlowEditorModal } from './src/components/FlowEditorModal';

// --- INITIAL STATES ---

// ... (code)
const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Data States
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, processed: 0, success: 0, errors: 0 });
  
  const [isFlowEditorOpen, setIsFlowEditorOpen] = useState(false);
  const [viewDetailsLead, setViewDetailsLead] = useState<CompanyResult | null>(null);
  
  // Logs State
  const [logs, setLogs] = useState<any[]>([]);

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
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignStep, setCampaignStep] = useState(1);
  const [newCampaign, setNewCampaign] = useState<{
     name: string;
     description: string;
     initialMessage: string;
     aiPersona: string;
     flowNodes?: any[];
     flowEdges?: any[];
  }>({
     name: '',
     description: '',
     initialMessage: 'Olá, tudo bem? Vi que sua empresa possui pendências na SEFAZ e gostaria de ajudar na regularização.',
     aiPersona: DEFAULT_AI_PERSONA
  });

  const [isCampaignFlowEditorOpen, setIsCampaignFlowEditorOpen] = useState(false);
  const [colFilters, setColFilters] = useState({
      inscricao: '',
      cnpj: '',
      razao: '',
      municipio: '',
      situacao: '',
      pagamento: '',
      motivo: ''
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
  const [isResettingWa, setIsResettingWa] = useState(false);
  
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Initial Load
  useEffect(() => {
    fetchCompanies();
    fetchImports();
    fetchFilters();
    fetchCampaigns();
    fetchAiConfig();
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'whatsapp') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  useInterval(() => {
    fetchWhatsAppStatus();
    if (activeTab === 'whatsapp' && waSession.status === 'connected') {
      fetchChats();
      if (activeChat) fetchMessages(activeChat);
    }
    if (activeTab === 'logs') {
        fetchLogs();
    }
    if (activeTab === 'import') {
        fetchImports();
        fetchCompanies();
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

  const handleResetWhatsApp = async () => {
    if (!window.confirm("Isso vai desconectar o WhatsApp e gerar um novo QR Code. Deseja continuar?")) return;
    setIsResettingWa(true);
    try {
      await fetch("/api/whatsapp/reset", { method: "POST" });
      setWaSession({ status: "disconnected" });
      setChats([]);
      setActiveChat(null);
      setChatMessages([]);
    } catch (e) {
      alert("Erro ao resetar conexão.");
    } finally {
      setIsResettingWa(false);
    }
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

  const startEditingCampaign = (campaign: any) => {
      setEditingCampaignId(campaign.id);
      
      let parsedNodes = [];
      let parsedEdges = [];
      try {
          if (campaign.flow_nodes) parsedNodes = typeof campaign.flow_nodes === 'string' ? JSON.parse(campaign.flow_nodes) : campaign.flow_nodes;
          if (campaign.flow_edges) parsedEdges = typeof campaign.flow_edges === 'string' ? JSON.parse(campaign.flow_edges) : campaign.flow_edges;
      } catch(e) {}
      
      setNewCampaign({
          name: campaign.name || '',
          description: campaign.description || '',
          initialMessage: campaign.initial_message || '',
          aiPersona: campaign.ai_persona || '',
          flowNodes: parsedNodes,
          flowEdges: parsedEdges
      });
      setCampaignStep(1);
      setIsCreatingCampaign(true);
  };
  
  const createCampaign = async () => {
    if (!newCampaign.name || (!editingCampaignId && selectedIds.size === 0)) return alert('Preencha os campos obrigatórios (incluindo leads se for nova).');
    try {
      if (editingCampaignId) {
          const res = await fetch(`/api/campaigns/${editingCampaignId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newCampaign)
          });
          if (res.ok) {
            alert('Campanha atualizada!');
            setIsCreatingCampaign(false);
            setEditingCampaignId(null);
            fetchCampaigns();
            setCampaignStep(1);
          }
      } else {
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
      }
    } catch (e: any) {
      alert('Erro ao criar campanha: ' + (e?.message || 'Tente novamente.'));
    }

  const filteredCompanies = useMemo(() => {
    return companies.filter(c => {
      const searchTxt = filters.search?.replace(/\D/g, '') || filters.search?.toLowerCase() || '';
      const searchMatch = !filters.search || 
        c.razaoSocial?.toLowerCase().includes(filters.search.toLowerCase()) ||
        c.cnpj?.includes(filters.search) ||
        c.telefone?.replace(/\D/g, '').includes(searchTxt);
      const cityMatch = !filters.city || c.municipio === filters.city;
      const reasonMatch = !filters.reason || (c.motivoSituacao && c.motivoSituacao === filters.reason);
      const waMatch = filters.statusWa === 'all' ? true : c.campaignStatus === filters.statusWa;
      const phoneMatch = filters.hasPhone === 'all' ? true : (filters.hasPhone === 'yes' ? !!c.telefone : !c.telefone);
      const accMatch = filters.hasAccountant === 'all' ? true : (filters.hasAccountant === 'yes' ? !!c.nomeContador : !c.nomeContador);
      
      const fInscricao = !colFilters.inscricao || c.inscricaoEstadual?.toLowerCase().includes(colFilters.inscricao.toLowerCase());
      const fCnpj = !colFilters.cnpj || c.cnpj?.includes(colFilters.cnpj);
      const fRazao = !colFilters.razao || c.razaoSocial?.toLowerCase().includes(colFilters.razao.toLowerCase());
      const fMunicipio = !colFilters.municipio || c.municipio?.toLowerCase().includes(colFilters.municipio.toLowerCase());
      const fSituacao = !colFilters.situacao || c.situacaoCadastral?.toLowerCase().includes(colFilters.situacao.toLowerCase());
      const fPagamento = !colFilters.pagamento || c.formaPagamento?.toLowerCase().includes(colFilters.pagamento.toLowerCase());
      const fMotivo = !colFilters.motivo || c.motivoSituacao?.toLowerCase().includes(colFilters.motivo.toLowerCase());

      return searchMatch && cityMatch && reasonMatch && waMatch && phoneMatch && accMatch && fInscricao && fCnpj && fRazao && fMunicipio && fSituacao && fPagamento && fMotivo;
    });
  }, [companies, filters, colFilters]);

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
      
      {/* Sidebar Standard */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 text-white transition-all duration-300 ease-in-out flex flex-col z-30 shadow-lg relative`}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between overflow-hidden">
          {isSidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-brand-600 flex items-center justify-center text-white shadow-sm">
                <Calculator size={18} />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <span className="text-base font-bold text-white leading-tight">Vírgula</span>
                <span className="text-[10px] font-medium text-slate-400 leading-tight">Contábil</span>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-md bg-brand-600 flex items-center justify-center text-white shadow-sm mx-auto">
                <Calculator size={18} />
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'import', icon: Upload, label: 'Importar PDF' },
            { id: 'campaigns', icon: Rocket, label: 'Campanhas' },
            { id: 'leads', icon: FileSpreadsheet, label: 'Base de Leads' },
            { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', badge: waSession.status === 'connected' ? 'On' : 'Off' },
            { id: 'knowledge', icon: BookOpen, label: 'Base de IA' },
            { id: 'logs', icon: ScrollText, label: 'Logs do Sistema' },
            { id: 'settings', icon: Settings, label: 'Configurações' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors relative ${
                activeTab === item.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              {isSidebarOpen && <span className="font-medium text-sm truncate">{item.label}</span>}
              {activeTab === item.id && <div className="absolute left-0 w-1 h-full bg-brand-500 rounded-r-md"></div>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 bg-slate-950/50">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Bot size={16} className={aiConfig.aiActive ? "text-emerald-400" : "text-slate-500"} />
                    {isSidebarOpen && <span className="text-xs font-medium text-slate-300">IA Geral</span>}
                </div>
                <button onClick={() => saveAiConfig({...aiConfig, aiActive: !aiConfig.aiActive})} className={`w-8 h-4 rounded-full p-0.5 transition-colors ${aiConfig.aiActive ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full transition-transform ${aiConfig.aiActive ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        
        {/* Header Standard */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 transition-colors">
              <Menu size={20} />
            </button>
            <h1 className="text-sm font-semibold text-slate-800 tracking-tight capitalize">{activeTab.replace('-', ' ')}</h1>
          </div>

          <div className="flex items-center gap-4">
             <button onClick={fetchCompanies} className="p-2 hover:bg-slate-100 rounded-md text-slate-400 hover:text-brand-600 transition-colors" title="Atualizar">
                <RefreshCw size={16} />
             </button>
             <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium ${waSession.status === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                <div className={`w-2 h-2 rounded-full ${waSession.status === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                <span>WhatsApp: {waSession.status === 'connected' ? 'Conectado' : 'Desconectado'}</span>
             </div>
          </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
          
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="max-w-7xl mx-auto space-y-8 pb-12">
              <div>
                <h2 className="text-xl font-semibold text-slate-800 mb-6">Visão Geral do Sistema</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: 'Total na Base', value: stats.total, icon: FileSpreadsheet, color: 'text-brand-600', bg: 'bg-brand-50' },
                    { label: 'Sucesso Sefaz', value: stats.success, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Erros Identificados', value: stats.errors, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                    { label: 'Campanhas ATIVAS', value: campaigns.length, icon: Rocket, color: 'text-amber-600', bg: 'bg-amber-50' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                        <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                      </div>
                      <div className={`p-2.5 rounded-md ${stat.bg} ${stat.color}`}>
                        <stat.icon size={20} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* KANBAN SECTION NO DASHBOARD */}
              <div>
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold text-slate-800">Funil de Vendas (Kanban)</h2>
                  </div>
                  <div className="h-[600px] flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                      {['pending', 'sent', 'replied', 'interested', 'not_interested'].map((status) => (
                          <div key={status} className="w-[320px] shrink-0 flex flex-col h-full bg-slate-100 rounded-lg p-3">
                              <div className="flex justify-between items-center mb-4 px-1 text-slate-700">
                                  <h3 className="font-semibold text-sm flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${status === 'pending' ? 'bg-slate-400' : status === 'interested' ? 'bg-emerald-500' : 'bg-brand-500'}`}></div>
                                      {status === 'pending' ? 'Prospecção' : status === 'sent' ? 'Contatados' : status === 'replied' ? 'Engajamento' : status === 'interested' ? 'Quentes' : 'Perdidos'}
                                  </h3>
                                  <span className="bg-slate-200 px-2 py-0.5 rounded text-xs font-medium">
                                      {companies.filter(c => c.campaignStatus === status).length}
                                  </span>
                              </div>
                              <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
                                  {companies.filter(c => c.campaignStatus === status).map(lead => (
                                      <KanbanCard key={lead.id} company={lead} onClick={() => { setActiveTab('whatsapp'); setActiveChat(lead.wa_id || (lead.telefone?.replace(/\D/g, '') + '@c.us')); }} />
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
            </div>
          )}

          {/* LOGS TAB */}
          {activeTab === 'logs' && (
             <div className="max-w-[1400px] mx-auto animate-fade-in pb-20 space-y-6">
                 <div className="flex items-center justify-between">
                     <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                         <ScrollText size={24} className="text-brand-600" /> System Monitor
                     </h2>
                     <button onClick={fetchLogs} className="btn-ghost text-xs font-bold uppercase">Refresh Logs</button>
                 </div>
                 
                 <div className="card-premium border-none shadow-xl bg-[#1f2937] text-slate-300 font-mono text-xs overflow-hidden rounded-[24px]">
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

          {/* CAMPAIGNS - WIZARD */}
          {activeTab === 'campaigns' && (
             <div className="max-w-6xl mx-auto pb-12">
                 {!isCreatingCampaign ? (
                     <div className="space-y-6">
                         <div className="flex justify-between items-center bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                             <div>
                                 <h2 className="text-xl font-semibold text-slate-800">Gestão de Campanhas</h2>
                                 <p className="text-sm text-slate-500 mt-1">Automação de Disparos em Massa com IA</p>
                             </div>
                             <button onClick={() => { setIsCreatingCampaign(true); setCampaignStep(1); }} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
                                 <Plus size={16} /> Nova Campanha
                             </button>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                             {campaigns.map(c => (
                                 <div key={c.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-brand-400 transition-colors relative group">
                                     <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button 
                                             onClick={() => startEditingCampaign(c)}
                                             className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-md transition-colors"
                                             title="Editar"
                                         >
                                             <Rocket size={16} />
                                         </button>
                                         <button 
                                         onClick={async () => {
                                                if (window.confirm("Deseja realmente excluir esta campanha? (os envios atuais não serão revertidos)")) {
                                                    try {
                                                        const res = await fetch(`/api/campaigns/${c.id}`, { method: 'DELETE' });
                                                        if (!res.ok) {
                                                            const data = await res.json().catch(() => ({}));
                                                            alert('Erro ao excluir campanha: ' + (data.error || res.status));
                                                        }
                                                        fetchCampaigns();
                                                    } catch(e) {
                                                        alert('Erro de conexão ao excluir campanha.');
                                                    }
                                                }
                                            }}
                                             className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                                             title="Excluir"
                                         >
                                             <X size={16} />
                                         </button>
                                     </div>
                                     <div className="flex justify-between items-start mb-4">
                                         <div className="p-2 bg-brand-50 text-brand-600 rounded-md"><Rocket size={18} /></div>
                                         <Badge variant="success">Ativa</Badge>
                                     </div>
                                     <h3 className="font-semibold text-slate-900 mb-1 truncate pr-16">{c.name}</h3>
                                     <p className="text-sm text-slate-500 line-clamp-2 mb-4">{c.description || 'Sem descrição definida.'}</p>
                                     <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
                                         <div className="text-center">
                                             <p className="text-xs text-slate-500 mb-1">Total</p>
                                             <p className="font-semibold text-slate-900">{c.stats?.total || 0}</p>
                                         </div>
                                         <div className="text-center border-l border-slate-100">
                                             <p className="text-xs text-slate-500 mb-1">Enviados</p>
                                             <p className="font-semibold text-brand-600">{c.stats?.sent || 0}</p>
                                         </div>
                                         <div className="text-center border-l border-slate-100">
                                             <p className="text-xs text-slate-500 mb-1">Respostas</p>
                                             <p className="font-semibold text-emerald-600">{c.stats?.replied || 0}</p>
                                         </div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 ) : (
                     <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden flex flex-col min-h-[600px]">
                         {/* Wizard Header */}
                         <div className="bg-slate-50 p-6 border-b border-slate-200 flex items-center justify-between">
                             <div>
                                 <h2 className="text-lg font-semibold text-slate-800">Setup de Campanha</h2>
                                 <div className="flex items-center gap-2 mt-2">
                                     <span className={`h-1.5 w-1.5 rounded-full ${campaignStep >= 1 ? 'bg-brand-500' : 'bg-slate-300'}`}></span>
                                     <span className={`h-1.5 w-6 rounded-full ${campaignStep >= 2 ? 'bg-brand-500' : 'bg-slate-300'}`}></span>
                                     <span className={`h-1.5 w-1.5 rounded-full ${campaignStep >= 3 ? 'bg-brand-500' : 'bg-slate-300'}`}></span>
                                     <span className="ml-2 text-xs font-medium text-slate-500">Passo {campaignStep} de 3</span>
                                 </div>
                             </div>
                             <button onClick={() => setIsCreatingCampaign(false)} className="p-2 hover:bg-white hover:text-rose-500 rounded-md text-slate-400 transition-colors"><X size={20}/></button>
                         </div>

                         {/* Wizard Body */}
                         <div className="flex-1 p-6 overflow-y-auto">
                             {campaignStep === 1 && (
                                 <div className="max-w-md mx-auto space-y-6 pt-8">
                                     <div className="text-center mb-8">
                                         <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4"><FileSpreadsheet size={24} /></div>
                                         <h3 className="text-lg font-semibold text-slate-800">Definições Iniciais</h3>
                                         <p className="text-slate-500 text-sm mt-1">Dê um nome para identificar este lote de disparos.</p>
                                     </div>
                                     <div className="space-y-4">
                                         <div>
                                             <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Campanha</label>
                                             <input className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500" placeholder="Ex: Lote Inaptidão 2024 - BA" value={newCampaign.name} onChange={e => setNewCampaign({...newCampaign, name: e.target.value})} autoFocus />
                                         </div>
                                         <div>
                                             <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (Opcional)</label>
                                             <textarea className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 h-24 resize-none" placeholder="Detalhes sobre o público alvo..." value={newCampaign.description} onChange={e => setNewCampaign({...newCampaign, description: e.target.value})} />
                                         </div>
                                     </div>
                                 </div>
                             )}

                             {campaignStep === 2 && (
                                 <div className="space-y-4 h-full flex flex-col">
                                     <div className="flex items-center justify-between mb-2">
                                         <h3 className="text-lg font-semibold text-slate-800">Seleção de Leads</h3>
                                         <div className="flex items-center gap-3">
                                             <Badge variant="brand">{selectedIds.size} Selecionados</Badge>
                                             {selectedIds.size > 0 && <button onClick={() => setSelectedIds(new Set())} className="text-sm font-medium text-rose-500 hover:underline">Limpar</button>}
                                         </div>
                                     </div>
                                     
                                     <FilterBar filters={filters} setFilters={setFilters} availableCities={availableCities} availableReasons={availableReasons} totalResults={filteredCompanies.length} />
                                     
                                     <div className="flex-1 bg-white border border-slate-200 rounded-lg overflow-hidden">
                                         <div className="h-[400px] overflow-y-auto">
                                            <CompanyTable 
                                                companies={filteredCompanies} 
                                                selectedIds={selectedIds} 
                                                toggleSelection={toggleSelection} 
                                                toggleSelectAll={toggleSelectAll} 
                                                selectable={true} 
                                                colFilters={colFilters}
                                                setColFilters={setColFilters}
                                            />
                                         </div>
                                     </div>
                                 </div>
                             )}

                             {campaignStep === 3 && (
                                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                                     <div className="space-y-4">
                                         <div className="flex items-center gap-2 mb-2">
                                             <div className="p-1.5 bg-brand-50 text-brand-600 rounded-md"><MessageCircle size={16} /></div>
                                             <h3 className="text-sm font-semibold text-slate-800">Mensagem Inicial</h3>
                                         </div>
                                         <p className="text-xs text-slate-500 mb-2">Esta mensagem será enviada para iniciar a conversa.</p>
                                         <textarea className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 h-48 resize-none" value={newCampaign.initialMessage} onChange={e => setNewCampaign({...newCampaign, initialMessage: e.target.value})} />
                                         
                                         {/* Flow Builder UI Section in Campaign */}
                                         <div className="pt-4 border-t border-slate-100 mt-4">
                                             <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg p-4">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-blue-800">Flow Builder IA</h4>
                                                    <p className="text-xs text-blue-600 mt-1">Crie um fluxo opcional guiado para esta campanha.</p>
                                                </div>
                                                <button 
                                                    onClick={() => setIsCampaignFlowEditorOpen(true)}
                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                                                >
                                                    {newCampaign.flowNodes && newCampaign.flowNodes.length > 0 ? 'Editar Fluxo' : 'Criar Fluxo'}
                                                </button>
                                             </div>
                                         </div>
                                     </div>
                                     <div className="space-y-4">
                                         <div className="flex items-center gap-2 mb-2">
                                             <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md"><Bot size={16} /></div>
                                             <h3 className="text-sm font-semibold text-slate-800">Persona Específica</h3>
                                         </div>
                                         <p className="text-xs text-slate-500 mb-2">Sobrescrever a persona padrão.</p>
                                         <textarea className="w-full px-3 py-2 border border-emerald-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 h-64 resize-none" value={newCampaign.aiPersona} onChange={e => setNewCampaign({...newCampaign, aiPersona: e.target.value})} />
                                     </div>
                                 </div>
                             )}
                         </div>

                         {/* Wizard Footer */}
                         <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                             {campaignStep > 1 ? (
                                 <button onClick={() => setCampaignStep(s => s - 1)} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
                                     <ArrowLeft size={16} /> Voltar
                                 </button>
                             ) : <div></div>}

                             {campaignStep < 3 ? (
                                 <button onClick={() => setCampaignStep(s => s + 1)} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors" disabled={campaignStep === 2 && selectedIds.size === 0}>
                                     Próximo <ArrowRight size={16} />
                                 </button>
                             ) : (
                                 <button onClick={createCampaign} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-bold flex items-center gap-2 transition-colors">
                                     <Play size={16} fill="currentColor" /> Disparar Campanha
                                 </button>
                             )}
                         </div>
                     </div>
                 )}
             </div>
          )}

          {/* LEADS TAB */}
          {activeTab === 'leads' && (
            <div className="max-w-6xl mx-auto space-y-6 pb-12">
                <FilterBar filters={filters} setFilters={setFilters} availableCities={availableCities} availableReasons={availableReasons} totalResults={filteredCompanies.length} />
                <CompanyTable 
                    companies={filteredCompanies} 
                    selectedIds={selectedIds} 
                    toggleSelection={toggleSelection} 
                    toggleSelectAll={toggleSelectAll} 
                    selectable={true}
                    onToggleAi={toggleLeadAI}
                    onChat={(lead: CompanyResult) => { setActiveTab('whatsapp'); setActiveChat(lead.wa_id || (lead.telefone?.replace(/\D/g, '') + '@c.us')); }}
                    onViewDetails={setViewDetailsLead}
                    colFilters={colFilters}
                    setColFilters={setColFilters}
                />
            </div>
          )}

          {/* KNOWLEDGE TAB */}
          {activeTab === 'knowledge' && (
            <div className="max-w-6xl mx-auto space-y-6 pb-12">
                <div className="flex items-center justify-between bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <div>
                        <h2 className="text-xl font-semibold text-slate-800 mb-1">Base de IA</h2>
                        <p className="text-sm text-slate-500">Heurística de Respostas Baseada em Motivos SEFAZ</p>
                    </div>
                    <button onClick={() => setEditingRule({ id: uuidv4(), motivoSituacao: '', instructions: [], isActive: true })} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium flex items-center gap-2 transition-colors">
                        <Plus size={16} /> Nova Regra
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {aiConfig.knowledgeRules.map(rule => (
                        <div key={rule.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col h-[360px] hover:border-brand-400 transition-colors">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-brand-50 text-brand-600 rounded-md"><BookOpen size={18} /></div>
                                <div className="flex gap-1">
                                    <button onClick={() => setEditingRule(rule)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-md transition-colors"><Edit size={16}/></button>
                                    <button onClick={() => {
                                        const nr = aiConfig.knowledgeRules.filter(r => r.id !== rule.id);
                                        saveAiConfig({...aiConfig, knowledgeRules: nr});
                                    }} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"><Trash2 size={16}/></button>
                                </div>
                            </div>
                            <h4 className="font-semibold text-slate-900 text-sm mb-3 leading-snug line-clamp-2 h-10">{rule.motivoSituacao}</h4>
                            <div className="mt-2 space-y-3 flex-1 overflow-y-auto custom-scrollbar pr-2">
                                {rule.reasonExplanation && (
                                    <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Motivo</p>
                                        <p className="text-xs text-slate-700">{rule.reasonExplanation}</p>
                                    </div>
                                )}
                                {rule.regularizationProcess && (
                                    <div className="p-3 bg-emerald-50 rounded-md border border-emerald-100/50">
                                        <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Regularização</p>
                                        <p className="text-xs text-emerald-800">{rule.regularizationProcess}</p>
                                    </div>
                                )}
                                {rule.requiredInfo && (
                                    <div className="p-3 bg-brand-50 rounded-md border border-brand-100/50">
                                        <p className="text-[10px] font-semibold text-brand-600 uppercase tracking-wider mb-1">Info. Necessária</p>
                                        <p className="text-xs text-brand-800">{rule.requiredInfo}</p>
                                    </div>
                                )}
                                {(rule.prazos || rule.valores) && (
                                    <div className="flex gap-2">
                                        {rule.prazos && (
                                            <div className="flex-1 p-3 bg-amber-50 rounded-md border border-amber-100/50">
                                                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Prazos</p>
                                                <p className="text-xs text-amber-800">{rule.prazos}</p>
                                            </div>
                                        )}
                                        {rule.valores && (
                                            <div className="flex-1 p-3 bg-blue-50 rounded-md border border-blue-100/50">
                                                <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mb-1">Valores</p>
                                                <p className="text-xs text-blue-800">{rule.valores}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {rule.defaultResponse && (
                                    <div className="p-3 bg-slate-100 rounded-md border border-slate-200/50">
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Fallback</p>
                                        <p className="text-xs text-slate-700 italic">"{rule.defaultResponse}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {editingRule && (
                    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-800">Nova Regra de IA</h3>
                                </div>
                                <button onClick={() => setEditingRule(null)} className="p-2 hover:bg-slate-100 rounded-md text-slate-400 transition-colors"><X size={20}/></button>
                            </div>
                            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Motivo SEFAZ (Alvo)</label>
                                    <div className="relative">
                                        <select 
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 uppercase pr-8 appearance-none bg-white" 
                                            value={editingRule.motivoSituacao} 
                                            onChange={e => setEditingRule({...editingRule, motivoSituacao: e.target.value})} 
                                        >
                                            <option value="" disabled hidden>SELECIONE UM MOTIVO...</option>
                                            {availableReasons.map((reason, idx) => <option key={idx} value={reason}>{reason}</option>)}
                                        </select>
                                        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Explicação do Motivo</label>
                                        <textarea className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 h-20 resize-none" value={editingRule.reasonExplanation || ''} onChange={e => setEditingRule({...editingRule, reasonExplanation: e.target.value})} placeholder="Por que a inscrição foi baixada/suspensa?" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Processo de Regularização</label>
                                        <textarea className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 h-20 resize-none" value={editingRule.regularizationProcess || ''} onChange={e => setEditingRule({...editingRule, regularizationProcess: e.target.value})} placeholder="Passo a passo para regularizar a situação..." />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Informações Necessárias</label>
                                        <textarea className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 h-20 resize-none" value={editingRule.requiredInfo || ''} onChange={e => setEditingRule({...editingRule, requiredInfo: e.target.value})} placeholder="Documentos e informações do cliente..." />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Prazos</label>
                                            <textarea className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 h-20 resize-none" value={editingRule.prazos || ''} onChange={e => setEditingRule({...editingRule, prazos: e.target.value})} placeholder="Prazos para regularização..." />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Valores</label>
                                            <textarea className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 h-20 resize-none" value={editingRule.valores || ''} onChange={e => setEditingRule({...editingRule, valores: e.target.value})} placeholder="Custos e taxas envolvidas..." />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Resposta Padrão (Fallback)</label>
                                        <textarea className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 h-20 resize-none" value={editingRule.defaultResponse || ''} onChange={e => setEditingRule({...editingRule, defaultResponse: e.target.value})} placeholder="Resposta de segurança..." />
                                    </div>
                                    
                                    {/* Botão do Flow Builder */}
                                    <div className="pt-4 border-t border-slate-100 mt-6">
                                        <div className="flex items-center justify-between bg-brand-50 border border-brand-100 rounded-lg p-4">
                                            <div>
                                                <h4 className="text-sm font-semibold text-brand-800">Flow Builder IA</h4>
                                                <p className="text-xs text-brand-600 mt-1">Crie um fluxo visual de respostas para este motivo.</p>
                                            </div>
                                            <button 
                                                onClick={() => setIsFlowEditorOpen(true)}
                                                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium transition-colors"
                                            >
                                                Editar Fluxo
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 rounded-b-lg">
                                <button onClick={() => setEditingRule(null)} className="px-4 py-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 rounded-md text-sm font-medium transition-colors">Cancelar</button>
                                <button onClick={() => {
                                     const nr = aiConfig.knowledgeRules.filter(r => r.id !== editingRule.id); nr.push(editingRule);
                                     saveAiConfig({...aiConfig, knowledgeRules: nr}); setEditingRule(null);
                                }} className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium transition-colors">Salvar Regra</button>
                            </div>
                        </div>
                    </div>
                )}
                
                {isFlowEditorOpen && editingRule && (
                    <FlowEditorModal 
                        rule={editingRule} 
                        onClose={() => setIsFlowEditorOpen(false)} 
                        onSave={(nodes: any[], edges: any[]) => {
                            setEditingRule({ ...editingRule, flowNodes: nodes, flowEdges: edges });
                            setIsFlowEditorOpen(false);
                            alert("Fluxo salvo na regra. Salve a regra principal para persistir no banco.");
                        }} 
                    />
                )}
            </div>
          )}

          {/* VIEW DETAILS MODAL */}
          {viewDetailsLead && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
                  <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                              <ScrollText className="text-brand-600" size={20} />
                              Detalhes da Empresa
                          </h3>
                          <button onClick={() => setViewDetailsLead(null)} className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <X size={20} />
                          </button>
                      </div>
                      <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                              <div>
                                  <span className="block text-xs font-semibold uppercase text-slate-400 mb-1">Razão Social</span>
                                  <p className="font-medium text-slate-800">{viewDetailsLead.razaoSocial || 'N/A'}</p>
                              </div>
                              <div>
                                  <span className="block text-xs font-semibold uppercase text-slate-400 mb-1">Nome Fantasia</span>
                                  <p className="font-medium text-slate-800">{viewDetailsLead.nomeFantasia || 'N/A'}</p>
                              </div>
                              <div>
                                  <span className="block text-xs font-semibold uppercase text-slate-400 mb-1">CNPJ</span>
                                  <p className="font-mono text-sm text-slate-700">{viewDetailsLead.cnpj || 'N/A'}</p>
                              </div>
                              <div>
                                  <span className="block text-xs font-semibold uppercase text-slate-400 mb-1">Inscrição Estadual</span>
                                  <p className="font-mono text-sm text-slate-700">{viewDetailsLead.inscricaoEstadual || 'N/A'}</p>
                              </div>
                              <div>
                                  <span className="block text-xs font-semibold uppercase text-slate-400 mb-1">Localização</span>
                                  <p className="text-sm border-l-2 border-brand-200 pl-2 text-slate-700">{viewDetailsLead.municipio} - {viewDetailsLead.uf}</p>
                              </div>
                              <div>
                                  <span className="block text-xs font-semibold uppercase text-slate-400 mb-1">Contato (Telefone)</span>
                                  <p className="font-mono text-sm text-brand-600">{viewDetailsLead.telefone || 'N/A'}</p>
                              </div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                              <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 border-b border-slate-200 pb-2">Status SEFAZ</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Situação Cadastral</span>
                                      <Badge variant={viewDetailsLead.situacaoCadastral?.includes('ATIVA') ? 'success' : 'danger'}>{viewDetailsLead.situacaoCadastral}</Badge>
                                  </div>
                                  <div>
                                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Data da Situação</span>
                                      <p className="text-sm font-medium text-slate-700">{viewDetailsLead.dataSituacaoCadastral || 'N/A'}</p>
                                  </div>
                                  <div className="col-span-1 md:col-span-2">
                                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Motivo / Detalhe</span>
                                      <p className="text-sm text-slate-800 bg-white p-3 rounded border border-slate-200 shadow-sm">{viewDetailsLead.motivoSituacao || 'N/A'}</p>
                                  </div>
                                  <div>
                                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Contador Responsável</span>
                                      <p className="text-sm font-medium text-slate-700">{viewDetailsLead.nomeContador || 'N/A'}</p>
                                  </div>
                                  <div>
                                      <span className="block text-[10px] uppercase text-slate-400 mb-1">Identificador WhatsApp (wa_id)</span>
                                      <p className="font-mono text-xs text-slate-500 break-all">{viewDetailsLead.wa_id || 'N/A'}</p>
                                  </div>
                              </div>
                          </div>
                      </div>
                      <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
                          <button className="btn-primary" onClick={() => {
                              setViewDetailsLead(null);
                              setActiveTab('whatsapp'); 
                              setActiveChat(viewDetailsLead.wa_id || (viewDetailsLead.telefone?.replace(/\D/g, '') + '@c.us'));
                          }}>
                              <MessageCircle size={16} /> Ir para o Chat
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {/* FLUXO EDITOR MODALS (Global) */}
          {isCampaignFlowEditorOpen && (
              <FlowEditorModal 
                  rule={{ motivoSituacao: "Campanha: " + (newCampaign.name || 'Nova'), flowNodes: newCampaign.flowNodes, flowEdges: newCampaign.flowEdges }} 
                  onClose={() => setIsCampaignFlowEditorOpen(false)} 
                  onSave={(nodes: any[], edges: any[]) => {
                      setNewCampaign({ ...newCampaign, flowNodes: nodes, flowEdges: edges });
                      setIsCampaignFlowEditorOpen(false);
                      alert("Fluxo da campanha salvo temporariamente. Finalize a criação da campanha para persistir.");
                  }} 
              />
          )}

           {/* SETTINGS TAB */}
           {activeTab === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-6 pb-12">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 text-slate-600 rounded-md"><Cpu size={20} /></div>
                          <h3 className="text-lg font-semibold text-slate-800">Provedor IA</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => setAiConfig({...aiConfig, provider: 'gemini', model: 'gemini-3-flash-preview'})} className={`p-4 rounded-md border flex flex-col items-center gap-2 transition-colors ${aiConfig.provider === 'gemini' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                                <Bot size={24} />
                                <span className="text-xs font-semibold">Google Gemini</span>
                            </button>
                            <button onClick={() => setAiConfig({...aiConfig, provider: 'groq', model: 'llama-3.1-8b-instant'})} className={`p-4 rounded-md border flex flex-col items-center gap-2 transition-colors ${aiConfig.provider === 'groq' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                                <Rocket size={24} />
                                <span className="text-xs font-semibold">Groq Llama</span>
                            </button>
                        </div>
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    API Key ({aiConfig.provider === 'gemini' ? 'AI Studio' : 'Groq'})
                                </label>
                                <input
                                    type="password"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
                                    value={aiConfig.provider === 'gemini' ? aiConfig.apiKeys?.gemini || '' : aiConfig.apiKeys?.groq || ''}
                                    onChange={e => {
                                        const k = { ...aiConfig.apiKeys, [aiConfig.provider]: e.target.value };
                                        setAiConfig({ ...aiConfig, apiKeys: k });
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-6">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 text-slate-600 rounded-md"><User size={20} /></div>
                          <h3 className="text-lg font-semibold text-slate-800">Persona IA</h3>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">System Instruction</label>
                            <textarea className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 h-48 resize-none" value={aiConfig.persona} onChange={e => setAiConfig({...aiConfig, persona: e.target.value})} />
                        </div>
                    </div>
                </div>

                <div className="bg-rose-50 border border-rose-200 p-6 rounded-lg flex flex-col md:flex-row items-center justify-between">
                    <div className="flex items-center gap-4 text-rose-700 mb-4 md:mb-0">
                        <AlertCircle size={24} />
                        <div>
                            <h4 className="font-semibold text-sm">Ações Irreversíveis</h4>
                            <p className="text-xs opacity-80 mt-1">Apagar leads soltos do sistema.</p>
                        </div>
                    </div>
                    <button onClick={async () => { if(confirm("Confirmar limpeza de base órfã?")) { await fetch('/api/cleanup', {method:'POST'}); fetchCompanies(); } }} className="px-4 py-2 bg-white border border-rose-300 text-rose-600 hover:bg-rose-100 rounded-md text-sm font-medium transition-colors">Limpar Base Órfã</button>
                </div>

                <div className="flex justify-end pt-4">
                    <button 
                        onClick={() => saveAiConfig(aiConfig)} 
                        disabled={isSavingConfig}
                        className="px-6 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed">
                        {isSavingConfig ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
          )}

          {/* WHATSAPP TAB */}
          {activeTab === 'whatsapp' && (
            <div className="flex h-full gap-6 mx-auto">
                {waSession.status !== 'connected' ? (
                   // QR CODE DISPLAY IF NOT CONNECTED
                   <div className="w-full flex-1 flex items-center justify-center p-6">
                      <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 text-center max-w-sm w-full">
                          <h2 className="text-xl font-semibold text-slate-800 mb-1">Conectar WhatsApp</h2>
                          <p className="text-slate-500 text-xs mb-8">Abra o App &gt; Aparelhos Conectados</p>
                          
                          <div className="inline-block p-4 bg-slate-50 rounded-lg border border-slate-200 mb-6 w-56 h-56 flex items-center justify-center">
                              {waSession.qrCode ? (
                                  <img src={waSession.qrCode} alt="QR Code" className="w-48 h-48 mix-blend-multiply" />
                              ) : (
                                  <div className="flex flex-col items-center justify-center text-slate-400 gap-3">
                                      <QrCode size={32} />
                                      <span className="text-xs font-medium">Buscando QR Code...</span>
                                  </div>
                              )}
                          </div>
                          
                          <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-50 rounded-md text-slate-600 text-xs font-medium mx-auto w-max border border-slate-200">
                              <div className={`w-2 h-2 rounded-full ${waSession.status === 'connecting' ? 'bg-amber-400' : 'bg-slate-400'}`}></div>
                              Status: {waSession.status}
                          </div>
                          <button
                              onClick={handleResetWhatsApp}
                              disabled={isResettingWa}
                              className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 rounded-md text-xs font-medium border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                              {isResettingWa ? "Limpando sessão..." : "Limpar sessão e gerar novo QR"}
                          </button>
                      </div>
                   </div>
                ) : (
                // EXISTING CHAT UI IF CONNECTED
                <>
                {/* Conversations Sidebar */}
                <div className="w-80 flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-800 text-sm">Conversas Ativas</h3>
                        <div className="flex items-center gap-2"><Badge variant="brand">{chats.length}</Badge><button onClick={handleResetWhatsApp} disabled={isResettingWa} title="Limpar sessão e gerar novo QR" className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors disabled:opacity-50" ><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button></div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
                        {chats.map(chat => (
                            <div key={chat.id} onClick={() => { setActiveChat(chat.id); fetchMessages(chat.id); }} className={`p-4 flex gap-3 hover:bg-slate-50 cursor-pointer transition-colors relative ${activeChat === chat.id ? 'bg-slate-50' : ''}`}>
                                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-700 shrink-0 text-sm">
                                    {getInitials(chat.name || '??')}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                        <p className="font-semibold text-slate-800 text-xs truncate pr-2">{chat.name || chat.id.replace(/\D/g, '')}</p>
                                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{chat.timestamp ? formatTime(chat.timestamp) : ''}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">{chat.lastMessage}</p>
                                </div>
                                {chat.unreadCount > 0 && <div className="absolute right-4 bottom-4 w-4 h-4 bg-brand-600 rounded-full flex items-center justify-center text-white text-[9px] font-bold">{chat.unreadCount}</div>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat Window */}
                <div className="flex-1 flex flex-col bg-[#efeae2] border border-slate-200 rounded-lg overflow-hidden relative shadow-sm">
                    <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e71a7b327317d924731d7986c.png')]"></div>
                    
                    {activeChat ? (
                        <>
                            <div className="p-3 px-4 bg-white border-b border-slate-200 flex justify-between items-center z-10 shadow-sm relative">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center font-bold text-white text-sm">
                                        {getInitials(chats.find(c => c.id === activeChat)?.name || '??')}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-slate-800 text-sm truncate max-w-[250px]">{chats.find(c => c.id === activeChat)?.name || activeChat.replace(/\D/g, '')}</h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                            <span className="text-[10px] font-medium text-emerald-600">
                                                {activeChatCompany ? activeChatCompany.razaoSocial?.substring(0, 30) + '...' : 'Live Chat'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {activeChatCompany && (
                                        <button onClick={() => toggleLeadAI(activeChatCompany.id, activeChatCompany.aiActive)} className={`px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1 border ${activeChatCompany.aiActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                                            <Bot size={14} />
                                            <span className="text-[10px] font-semibold">IA {activeChatCompany.aiActive ? 'On' : 'Off'}</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 custom-scrollbar z-0 flex flex-col">
                                {chatMessages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] md:max-w-[70%] px-3 py-2 rounded-lg text-sm shadow-sm relative ${msg.fromMe ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr flex' : 'bg-white text-[#111b21] rounded-tl flex'}`}>
                                            <p className="whitespace-pre-wrap flex-1 min-w-0 pb-3">{msg.body}</p>
                                            <div className={`flex items-center gap-0.5 absolute bottom-1 right-2 ${msg.fromMe ? 'text-[#8696a0]' : 'text-[#8696a0]'}`}>
                                                <span className="text-[9px] truncate">{formatTime(msg.timestamp)}</span>
                                                {msg.fromMe && <Check size={12} className="text-brand-500"/>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            <div className="p-3 bg-[#f0f2f5] flex items-center gap-3 z-10 relative">
                                <button className="p-2 text-slate-500 hover:text-slate-700"><Smile size={24}/></button>
                                <div className="flex-1 relative">
                                    <input 
                                        className="w-full bg-white border border-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand-300 text-slate-800 shadow-sm"
                                        placeholder="Digite uma mensagem..."
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                                    />
                                </div>
                                <button onClick={handleSendMessage} className="p-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors">
                                    <Send size={18} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-[#f0f2f5] z-10 relative">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 text-slate-300 shadow-sm">
                                <MessageCircle size={32} />
                            </div>
                            <h2 className="text-xl font-medium text-slate-600 mb-1">WhatsApp Web</h2>
                            <p className="text-sm max-w-sm mb-6">Selecione uma conversa para começar a enviar mensagens.</p>
                        </div>
                    )}
                </div>
                </>
                )}
            </div>
          )}

          {/* IMPORT TAB */}
          {activeTab === 'import' && (
            <div className="max-w-4xl mx-auto space-y-6 pb-12">
                <div className="bg-white p-8 border-2 border-dashed border-slate-300 hover:border-brand-500 transition-colors rounded-lg text-center relative group">
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer z-10" onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (!file) return;
                         const fd = new FormData(); fd.append('file', file);
                         fetch('/start-processing', {method: 'POST', body: fd}).then(() => fetchImports());
                    }} />
                    <div className="w-14 h-14 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                        <Upload size={24} />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-800 mb-2">Importar PDF SEFAZ</h2>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto">
                      Arraste o arquivo PDF ou clique para selecionar. O sistema extrairá e criará os leads.
                    </p>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col min-h-[300px]">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                           <Activity size={16} className="text-slate-400" /> Histórico de Importações
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100 flex-1 overflow-y-auto custom-scrollbar">
                        {imports.length === 0 && (
                          <div className="p-12 text-center text-slate-500">
                            <FileSpreadsheet size={32} className="mx-auto mb-3 text-slate-300" />
                            <p className="text-sm">Nenhuma importação realizada ainda.</p>
                          </div>
                        )}
                        {imports.map(imp => (
                            <div key={imp.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-slate-100 rounded-md flex items-center justify-center text-slate-400">
                                        <FileSpreadsheet size={20} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800 text-sm truncate max-w-[200px]">{imp.filename}</p>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                            <span>{new Date(imp.date).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span className="font-medium">{imp.total} registros</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 md:ml-auto">
                                    {imp.status !== 'completed' && imp.status !== 'error' && imp.total > 0 && (
                                        <div className="w-32 hidden md:block">
                                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                                <span>Progresso</span>
                                                <span>{Math.round((imp.processed / imp.total) * 100)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-brand-500 transition-all duration-300" style={{ width: `${(imp.processed / imp.total) * 100}%` }}></div>
                                            </div>
                                        </div>
                                    )}
                                    <Badge variant={imp.status === 'completed' ? 'success' : imp.status === 'error' ? 'error' : 'warning'}>{imp.status.toUpperCase()}</Badge>
                                    <div className="flex gap-1">
                                        <button onClick={async () => {
                                            if (confirm("Deseja re-extrair os dados dessa lista na SEFAZ? O lead será mantido no histórico.")) {
                                                await fetch(`/api/imports/${imp.id}/refresh`, { method: 'POST' });
                                                fetchImports();
                                                fetchCompanies();
                                            }
                                        }} className="p-2 text-slate-400 hover:text-brand-600 transition-colors rounded-md hover:bg-brand-50" title="Atualizar (Re-extratir)">
                                            <RefreshCw size={16}/>
                                        </button>
                                        <button onClick={() => deleteImport(imp.id)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors rounded-md hover:bg-rose-50" title="Remover histórico">
                                          <Trash2 size={16}/>
                                        </button>
                                    </div>
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
