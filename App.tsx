import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Upload, MessageCircle, Bot, Settings, Menu, FileSpreadsheet, Search,
  CheckCircle2, AlertCircle, Send, RefreshCw, BookOpen, Plus, Trash2,
  Briefcase, MessageSquare, User, Paperclip, Mic, X, Save,
  BarChart3, Rocket, Sparkles, CheckSquare, Square, Trello, MoreHorizontal, PauseCircle, PlayCircle, Edit,
  ToggleLeft, ToggleRight, Power, Phone, MoreVertical, Smile, Paperclip as PaperclipIcon, Check, Eye, EyeOff, Cpu,
  Filter, ChevronRight, Hash, ExternalLink
} from 'lucide-react';
import { CompanyResult, Status, CampaignStatus, KnowledgeRule, AIConfig, WhatsAppSession, ImportBatch, Instruction } from './types';
import { DEFAULT_KNOWLEDGE_RULES, DEFAULT_AI_PERSONA } from './constants';
import { v4 as uuidv4 } from 'uuid';

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) { return initialValue; }
  });
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') window.localStorage.setItem(key, JSON.stringify(valueToStore));
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
      'queued': 'Na Fila', 
      'sent': 'Enviado', 
      'replied': 'Respondeu', 
      'interested': 'Interessado', 
      'not_interested': 'Descartado', 
      'error': 'Erro', 
      'skipped': 'Sem Zap' 
    };
    return <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${map[status] || map['pending']}`}>{labels[status] || status}</span>;
}

const FilterBar = React.memo(({ filters, setFilters, availableCities, availableReasons, onRefresh, compact = false }: any) => (
  <div className={`card-premium ${compact ? 'p-3' : 'p-5'} flex flex-col gap-4 mb-6 animate-fade-in shadow-sm border-slate-200/60 bg-white`}>
    {!compact && (
      <div className="flex flex-col lg:flex-row gap-4 items-center">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por Razão Social, CNPJ ou IE..." 
            className="input-premium pl-12 h-12" 
            value={filters.search} 
            onChange={e => setFilters((p: any) => ({...p, search: e.target.value}))} 
          />
        </div>
        <div className="flex gap-2 w-full lg:w-auto">
          <button onClick={onRefresh} className="btn-secondary h-12 px-4 flex items-center gap-2">
            <RefreshCw size={18} className="text-brand-600" />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>
    )}
    <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${compact ? 'lg:grid-cols-4' : 'lg:grid-cols-6'} gap-3`}>
      {compact && (
        <div className="space-y-1 md:col-span-2 lg:col-span-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Busca Rápida</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              className="input-premium pl-9 py-2 text-xs h-10" 
              placeholder="Empresa..."
              value={filters.search} 
              onChange={e => setFilters((p: any) => ({...p, search: e.target.value}))} 
            />
          </div>
        </div>
      )}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Cidade</label>
        <select className="input-premium py-2 text-xs h-10" value={filters.city} onChange={e => setFilters((p: any) => ({...p, city: e.target.value}))}>
          <option value="">Todas Cidades</option>
          {availableCities.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Motivo SEFAZ</label>
        <select className="input-premium py-2 text-xs h-10" value={filters.reason} onChange={e => setFilters((p: any) => ({...p, reason: e.target.value}))}>
          <option value="">Todos Motivos</option>
          {availableReasons.map((r: string) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {!compact && (
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Status Campanha</label>
          <select className="input-premium py-2 text-xs h-10" value={filters.statusWa} onChange={e => setFilters((p: any) => ({...p, statusWa: e.target.value}))}>
            <option value="all">Todos Status</option>
            <option value="pending">Pendente</option>
            <option value="queued">Na Fila</option>
            <option value="sent">Enviado</option>
            <option value="replied">Respondeu</option>
            <option value="error">Erro</option>
          </select>
        </div>
      )}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Telefone</label>
        <select className="input-premium py-2 text-xs h-10" value={filters.hasPhone} onChange={e => setFilters((p: any) => ({...p, hasPhone: e.target.value}))}>
          <option value="all">Qualquer</option>
          <option value="yes">Com Telefone</option>
          <option value="no">Sem Telefone</option>
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Contador</label>
        <select className="input-premium py-2 text-xs h-10" value={filters.hasAccountant} onChange={e => setFilters((p: any) => ({...p, hasAccountant: e.target.value}))}>
          <option value="all">Qualquer</option>
          <option value="yes">Com Contador</option>
          <option value="no">Sem Contador</option>
        </select>
      </div>
      <div className="flex items-end">
        <button 
          onClick={() => setFilters({ search: '', city: '', reason: '', hasAccountant: 'all', status: 'all', statusWa: 'all', hasPhone: 'all' })}
          className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase w-full pb-3 text-center"
        >
          Limpar Filtros
        </button>
      </div>
    </div>
  </div>
));

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [companies, setCompanies] = useState<CompanyResult[]>([]);
  const [imports, setImports] = useState<ImportBatch[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, processed: 0, success: 0, errors: 0 });
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const [processProgress, setProcessProgress] = useState({ total: 0, processed: 0, status: '' });
  const [filters, setFilters] = useState({ search: '', city: '', reason: '', hasAccountant: 'all', status: 'all', statusWa: 'all', hasPhone: 'all' });
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableReasons, setAvailableReasons] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingCampaign, setViewingCampaign] = useState<any | null>(null);
  const [campaignLeads, setCampaignLeads] = useState<CompanyResult[]>([]);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaignStep, setCampaignStep] = useState(1);
  const [newCampaign, setNewCampaign] = useState({ 
    name: '', 
    description: '', 
    initialMessage: 'Olá, tudo bem? Notei que sua empresa possui uma pendência na SEFAZ. Sou consultor tributário e posso ajudar na regularização.', 
    aiPersona: DEFAULT_AI_PERSONA 
  });
  const [aiConfig, setAiConfig] = useLocalStorage<AIConfig>('crm_ai_config', { 
    model: 'gemini-3-flash-preview', 
    provider: 'gemini', 
    apiKeys: { gemini: '', groq: '' }, 
    persona: DEFAULT_AI_PERSONA, 
    knowledgeRules: [], 
    temperature: 0.7, 
    aiActive: true 
  });
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
    fetchAiConfig(); 
  }, []);

  useInterval(() => { 
    fetchWhatsAppStatus(); 
    if (activeTab === 'whatsapp' && waSession.status === 'connected') { 
      fetchChats(); 
      if (activeChat) fetchMessages(activeChat); 
    } 
  }, 3000);
  
  // Progress SSE handler
  useEffect(() => {
    if (currentProcessId) {
      const eventSource = new EventSource(`/progress/${currentProcessId}`);
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setProcessProgress(data);
        if (data.status === 'completed' || data.status === 'error') {
          eventSource.close();
          fetchCompanies();
          fetchImports();
          fetchFilters();
          setTimeout(() => setCurrentProcessId(null), 3000);
        }
      };
      eventSource.onerror = () => eventSource.close();
      return () => eventSource.close();
    }
  }, [currentProcessId]);

  const fetchAiConfig = async () => { try { const res = await fetch('/api/config'); if (res.ok) setAiConfig(await res.json()); } catch (e) {} };
  const fetchFilters = async () => { try { const res = await fetch('/api/unique-filters'); if (res.ok) { const d = await res.json(); setAvailableCities(d.municipios); setAvailableReasons(d.motivos); } } catch (e) {} };
  const fetchCampaigns = async () => { try { const res = await fetch('/api/campaigns'); if (res.ok) setCampaigns(await res.json()); } catch (e) {} };
  const fetchCompanies = async () => { try { const res = await fetch('/get-all-results'); if (res.ok) { const d = await res.json(); setCompanies(d); setStats({ total: d.length, processed: d.length, success: d.filter((c:any) => c.status === 'Sucesso').length, errors: d.filter((c:any) => c.status !== 'Sucesso').length }); } } catch (e) {} };
  const fetchImports = async () => { try { const res = await fetch('/get-imports'); if (res.ok) setImports(await res.json()); } catch (e) {} };
  const fetchWhatsAppStatus = async () => { try { const res = await fetch('/api/whatsapp/status'); if (res.ok) { const d = await res.json(); setWaSession({ status: d.status, qrCode: d.qr }); } } catch (e) {} };
  const fetchChats = async () => { try { const res = await fetch('/api/whatsapp/chats'); if (res.ok) setChats(await res.json()); } catch (e) {} };
  const fetchMessages = async (id: string) => { try { const res = await fetch(`/api/whatsapp/messages/${id}`); if (res.ok) setChatMessages(await res.json()); } catch (e) {} };
  const fetchCampaignLeads = async (id: string) => { try { const res = await fetch(`/api/campaigns/${id}/leads`); if (res.ok) setCampaignLeads(await res.json()); } catch (e) {} };

  const sendMessage = async () => {
    if (!activeChat || !newMessage.trim()) return;
    try {
      const res = await fetch('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: activeChat, message: newMessage }) });
      if (res.ok) { setNewMessage(''); fetchMessages(activeChat); }
    } catch (e) {}
  };

  const saveAiConfig = async (conf: AIConfig) => {
    setIsSavingConfig(true);
    try { const res = await fetch('/api/config/ai-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...conf, apiKeys: conf.apiKeys }) }); if (res.ok) setAiConfig(await res.json()); } catch (e) {} finally { setIsSavingConfig(false); }
  };

  const createCampaign = async () => {
    try {
      const res = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newCampaign, leads: Array.from(selectedIds) }) });
      if (res.ok) { setIsCreatingCampaign(false); setSelectedIds(new Set()); setCampaignStep(1); fetchCampaigns(); fetchCompanies(); }
    } catch (e) {}
  };

  const deleteCampaign = async (id: string) => { if (confirm('Excluir esta campanha?')) { try { await fetch(`/api/campaigns/${id}`, { method: 'DELETE' }); fetchCampaigns(); fetchCompanies(); } catch (e) {} } };
  const deleteImport = async (id: string) => { if (confirm('Remover importação? Isso apagará os dados vinculados.')) { try { await fetch(`/api/imports/${id}`, { method: 'DELETE' }); fetchImports(); fetchCompanies(); } catch (e) {} } };

  const filteredCompanies = useMemo(() => companies.filter(c => {
    const s = !filters.search || 
             c.razaoSocial?.toLowerCase().includes(filters.search.toLowerCase()) || 
             c.cnpj?.includes(filters.search) ||
             c.inscricaoEstadual?.includes(filters.search);
    const ct = !filters.city || c.municipio === filters.city;
    const rs = !filters.reason || (c.motivoSituacao && c.motivoSituacao.includes(filters.reason));
    const acc = filters.hasAccountant === 'all' ? true : filters.hasAccountant === 'yes' ? !!c.nomeContador : !c.nomeContador;
    const st = filters.status === 'all' ? true : c.status === filters.status;
    const swa = filters.statusWa === 'all' ? true : c.campaignStatus === filters.statusWa;
    const ph = filters.hasPhone === 'all' ? true : filters.hasPhone === 'yes' ? !!c.telefone : !c.telefone;
    return s && ct && rs && acc && st && swa && ph;
  }), [companies, filters]);

  const toggleSelection = (id: string) => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); };
  const toggleSelectAllVisible = () => {
    const visibleIds = filteredCompanies.map(c => c.id);
    const allVisibleSelected = visibleIds.every(id => selectedIds.has(id));
    const n = new Set(selectedIds);
    if (allVisibleSelected) {
      visibleIds.forEach(id => n.delete(id));
    } else {
      visibleIds.forEach(id => n.add(id));
    }
    setSelectedIds(n);
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-brand-950 text-white transition-all flex flex-col shadow-2xl z-20`}>
        <div className="p-5 flex items-center justify-between border-b border-brand-800/30">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 bg-brand-500 rounded-lg flex items-center justify-center font-black shadow-lg shadow-brand-500/20">V</div>
            {isSidebarOpen && <span className="font-bold tracking-tight text-lg whitespace-nowrap">CRM VÍRGULA</span>}
          </div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 hover:bg-brand-900 rounded-lg transition-colors"><Menu size={18} /></button>
        </div>
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto custom-scrollbar">
          {[{ id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' }, 
            { id: 'kanban', icon: Trello, label: 'Kanban Vendas' }, 
            { id: 'import', icon: Upload, label: 'Importar PDF' }, 
            { id: 'companies', icon: FileSpreadsheet, label: 'Base de Empresas' }, 
            { id: 'campaigns', icon: Rocket, label: 'Gestão de Campanhas' }, 
            { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', badge: waSession.status==='connected'?'On':'Off' }, 
            { id: 'knowledge', icon: BookOpen, label: 'Conhecimento IA' }, 
            { id: 'settings', icon: Settings, label: 'Configurações' }
          ].map(i => (
            <button key={i.id} onClick={() => setActiveTab(i.id)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all relative group ${activeTab === i.id ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' : 'text-brand-300 hover:bg-brand-900/50 hover:text-white'}`}>
              <i.icon size={20} className={activeTab === i.id ? 'scale-110 transition-transform' : ''} />
              {isSidebarOpen && <span className="text-sm font-medium flex-1 text-left">{i.label}</span>}
              {!isSidebarOpen && <div className="absolute left-full ml-4 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">{i.label}</div>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto relative flex flex-col">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-8 py-5 flex items-center justify-between">
          <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">{activeTab.replace('-', ' ')}</h1>
          <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-100 rounded-full">
            <div className={`w-2 h-2 rounded-full ${waSession.status==='connected'?'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]':'bg-rose-500'}`}></div>
            <span className="text-[10px] font-bold text-slate-500 uppercase">{waSession.status==='connected'?'WhatsApp Conectado':'WhatsApp Desconectado'}</span>
          </div>
        </header>

        <div className="p-8 max-w-[1600px] mx-auto w-full flex-1">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
              {[{l:'Empresas na Base',v:stats.total, i:FileSpreadsheet, c:'brand'},
                {l:'Sucesso Sefaz',v:stats.success, i:CheckCircle2, c:'emerald'},
                {l:'Erros Raspagem',v:stats.errors, i:AlertCircle, c:'rose'},
                {l:'Campanhas',v:campaigns.length, i:Rocket, c:'purple'}
              ].map((s,i) => (
                <div key={i} className="card-premium p-6 card-hover border-slate-200/50">
                  <div className={`p-3 bg-${s.c}-50 rounded-2xl text-${s.c}-600 inline-block mb-4`}><s.i size={24} /></div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{s.l}</p>
                  <h3 className="text-3xl font-black text-slate-800 tracking-tight">{s.v}</h3>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
              <div className="card-premium p-10 text-center border-2 border-dashed border-slate-200 hover:border-brand-400 transition-all relative group bg-white">
                {!currentProcessId ? (
                  <>
                    <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => { 
                      const f = e.target.files?.[0]; 
                      if(f) { 
                        const fd = new FormData(); 
                        fd.append('file', f); 
                        const r = await fetch('/start-processing', { method:'POST', body:fd }); 
                        if(r.ok) setCurrentProcessId((await r.json()).processId); 
                      } 
                    }} />
                    <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-brand-500 group-hover:scale-110 transition-transform">
                      <Upload size={28} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Clique ou arraste o PDF SEFAZ</h2>
                    <p className="text-xs text-slate-500">O sistema irá ler as Inscrições Estaduais e buscar os dados detalhados.</p>
                  </>
                ) : (
                  <div className="py-6">
                    <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Processando {processProgress.processed} / {processProgress.total}</h3>
                    <div className="bg-slate-100 h-2 rounded-full max-w-xs mx-auto overflow-hidden">
                      <div className="bg-brand-500 h-full transition-all" style={{width: `${(processProgress.processed/processProgress.total)*100}%`}}></div>
                    </div>
                  </div>
                )}
              </div>
              <div className="card-premium overflow-hidden bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b">
                    <tr><th className="px-6 py-4">Arquivo</th><th className="px-6 py-4">Data</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Ação</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {imports.map(i => (
                      <tr key={i.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-bold text-slate-700">{i.filename}</td>
                        <td className="px-6 py-4 text-slate-500">{new Date(i.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-xs font-bold text-brand-600">{i.total} Leads</td>
                        <td className="px-6 py-4 text-right"><button onClick={() => deleteImport(i.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={18}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'companies' && (
            <div className="space-y-4 animate-fade-in">
              <FilterBar filters={filters} setFilters={setFilters} availableCities={availableCities} availableReasons={availableReasons} onRefresh={fetchCompanies} />
              <div className="card-premium overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b">
                      <tr>
                        <th className="px-6 py-5">Razão Social / CNPJ</th>
                        <th className="px-6 py-5">IE</th>
                        <th className="px-6 py-5">Cidade</th>
                        <th className="px-6 py-5">Motivo / Situação</th>
                        <th className="px-6 py-5">Status WA</th>
                        <th className="px-6 py-5">Telefone</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCompanies.map(c => (
                        <tr key={c.id} className="hover:bg-brand-50/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800">{c.razaoSocial}</div>
                            <div className="text-[10px] text-slate-400">{c.cnpj}</div>
                          </td>
                          <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{c.inscricaoEstadual}</td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-600">{c.municipio}</td>
                          <td className="px-6 py-4">
                            <div className="text-xs text-brand-600 font-bold truncate max-w-[200px]" title={c.motivoSituacao}>{c.motivoSituacao}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">{c.situacaoCadastral}</div>
                          </td>
                          <td className="px-6 py-4"><StatusBadge status={c.campaignStatus} /></td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-600">{c.telefone || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 bg-slate-50 border-t flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>{filteredCompanies.length} de {companies.length} registros</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div className="space-y-6 animate-fade-in">
               {!isCreatingCampaign ? (
                 <>
                   <div className="flex justify-between items-center mb-4">
                     <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Campanhas</h2>
                     <button onClick={() => setIsCreatingCampaign(true)} className="btn-primary h-11 px-6"><Plus size={20}/> Nova Campanha</button>
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     {campaigns.map(c => (
                       <div key={c.id} onClick={() => { setViewingCampaign(c); fetchCampaignLeads(c.id); }} className="card-premium p-6 cursor-pointer hover:border-brand-400 group relative bg-white">
                         <button onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id); }} className="absolute top-4 right-4 text-slate-200 hover:text-rose-500 group-hover:opacity-100 opacity-0"><Trash2 size={18}/></button>
                         <div className="flex items-center gap-3 mb-4">
                           <div className="p-2.5 bg-brand-600 rounded-xl text-white"><Rocket size={20}/></div>
                           <h3 className="font-bold text-slate-800 truncate uppercase tracking-tight">{c.name}</h3>
                         </div>
                         <div className="grid grid-cols-3 gap-1 mb-4 bg-slate-50 rounded-xl p-1">
                           <div className="bg-white p-2 rounded-lg text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Leads</p><p className="font-black text-sm">{c.stats?.total || 0}</p></div>
                           <div className="bg-white p-2 rounded-lg text-center"><p className="text-[8px] font-black text-slate-400 uppercase text-brand-600">Enviados</p><p className="font-black text-sm text-brand-600">{c.stats?.sent || 0}</p></div>
                           <div className="bg-white p-2 rounded-lg text-center"><p className="text-[8px] font-black text-slate-400 uppercase text-emerald-600">Retornos</p><p className="font-black text-sm text-emerald-600">{c.stats?.replied || 0}</p></div>
                         </div>
                         <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest pt-4 border-t border-slate-100">
                           <span>{new Date(c.created_at).toLocaleDateString()}</span>
                           <span className="text-brand-600 flex items-center gap-1 group-hover:gap-2 transition-all">Gerenciar <ChevronRight size={12}/></span>
                         </div>
                       </div>
                     ))}
                   </div>
                 </>
               ) : (
                 <div className="max-w-5xl mx-auto card-premium overflow-hidden bg-white shadow-2xl animate-slide-up">
                   <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                     <h2 className="text-lg font-black text-slate-800 uppercase">Configurar Campanha</h2>
                     <button onClick={() => setIsCreatingCampaign(false)} className="p-2 hover:bg-slate-200 rounded-lg"><X/></button>
                   </div>
                   <div className="p-8">
                     {campaignStep === 1 && (
                       <div className="space-y-6 animate-fade-in">
                         <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Nome</label><input className="input-premium h-12" placeholder="Ex: Regularização MEI Salvador" value={newCampaign.name} onChange={e=>setNewCampaign({...newCampaign, name:e.target.value})} /></div>
                         <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Descrição</label><textarea className="input-premium h-24" placeholder="Detalhes internos..." value={newCampaign.description} onChange={e=>setNewCampaign({...newCampaign, description:e.target.value})} /></div>
                         <button onClick={()=>setCampaignStep(2)} className="btn-primary w-full h-12 text-lg uppercase tracking-widest font-black" disabled={!newCampaign.name}>Próximo Passo</button>
                       </div>
                     )}
                     {campaignStep === 2 && (
                       <div className="space-y-4 animate-fade-in">
                         <div className="flex justify-between items-center">
                           <h3 className="font-bold text-slate-700 uppercase text-sm">Filtrar e Selecionar Leads ({selectedIds.size})</h3>
                           <button onClick={toggleSelectAllVisible} className="text-xs font-black text-brand-600 uppercase hover:underline">
                             {filteredCompanies.every(c => selectedIds.has(c.id)) ? 'Deselecionar Visíveis' : 'Selecionar Visíveis'}
                           </button>
                         </div>
                         <FilterBar filters={filters} setFilters={setFilters} availableCities={availableCities} availableReasons={availableReasons} compact={true} />
                         <div className="h-[400px] overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50/30 custom-scrollbar">
                           <table className="w-full text-xs text-left bg-white">
                             <thead className="bg-slate-100/80 sticky top-0 z-10 border-b">
                               <tr>
                                 <th className="p-4 w-10"></th>
                                 <th className="p-4">Empresa</th>
                                 <th className="p-4">IE</th>
                                 <th className="p-4">Cidade</th>
                                 <th className="p-4">Motivo</th>
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100">
                               {filteredCompanies.map(c => (
                                 <tr key={c.id} onClick={() => toggleSelection(c.id)} className={`cursor-pointer transition-colors ${selectedIds.has(c.id) ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
                                   <td className="p-4 text-center"><div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${selectedIds.has(c.id) ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-300'}`}>{selectedIds.has(c.id) && <Check size={14}/>}</div></td>
                                   <td className="p-4 font-bold text-slate-800">{c.razaoSocial}</td>
                                   <td className="p-4 text-slate-500 font-mono">{c.inscricaoEstadual}</td>
                                   <td className="p-4 text-slate-600">{c.municipio}</td>
                                   <td className="p-4 text-brand-600 font-bold max-w-[150px] truncate">{c.motivoSituacao}</td>
                                 </tr>
                               ))}
                             </tbody>
                           </table>
                         </div>
                         <div className="flex justify-between pt-4">
                           <button onClick={()=>setCampaignStep(1)} className="btn-secondary h-11 px-6 uppercase font-black text-xs tracking-widest">Voltar</button>
                           <button onClick={()=>setCampaignStep(3)} className="btn-primary h-11 px-10 uppercase font-black text-xs tracking-widest" disabled={selectedIds.size === 0}>Definir Mensagem</button>
                         </div>
                       </div>
                     )}
                     {campaignStep === 3 && (
                       <div className="space-y-6 animate-fade-in">
                         <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Mensagem Inicial (WhatsApp)</label><textarea className="input-premium h-48 text-sm" value={newCampaign.initialMessage} onChange={e=>setNewCampaign({...newCampaign, initialMessage:e.target.value})} /></div>
                         <div className="flex justify-between pt-4">
                           <button onClick={()=>setCampaignStep(2)} className="btn-secondary h-11 px-6 uppercase font-black text-xs tracking-widest">Voltar</button>
                           <button onClick={createCampaign} className="btn-success h-11 px-10 uppercase font-black text-xs tracking-widest shadow-emerald-500/20">Lançar Campanha</button>
                         </div>
                       </div>
                     )}
                   </div>
                 </div>
               )}
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className="flex h-[calc(100vh-200px)] gap-6 animate-fade-in">
              <div className="w-80 card-premium flex flex-col bg-white overflow-hidden shadow-sm">
                <div className="p-5 border-b font-black text-slate-800 text-sm uppercase tracking-tight">Conversas</div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {waSession.qrCode && waSession.status!=='connected' ? (
                    <div className="p-6 text-center">
                      <div className="bg-white p-2 rounded-xl shadow-sm inline-block mb-4"><img src={waSession.qrCode} className="w-40 h-40" /></div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-loose">Escaneie o QR Code no seu WhatsApp celular.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {chats.map(c => (
                        <div key={c.id} onClick={()=>{setActiveChat(c.id);fetchMessages(c.id);}} className={`p-4 hover:bg-slate-50 cursor-pointer flex items-center gap-3 ${activeChat===c.id?'bg-brand-50/50 border-r-4 border-brand-500':''}`}>
                          <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400 uppercase text-xs">{getInitials(c.name || c.id)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-800 text-xs truncate">{c.name || c.id}</div>
                            <div className="text-[10px] text-slate-400 truncate mt-0.5">{c.lastMessage}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 card-premium flex flex-col bg-[#efeae2] relative overflow-hidden shadow-xl">
                {activeChat ? (
                  <>
                    <div className="p-4 bg-white/95 border-b flex items-center gap-3 z-10 shadow-sm"><div className="w-9 h-9 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-black text-xs">{getInitials(chats.find(c=>c.id===activeChat)?.name || activeChat)}</div><h3 className="font-bold text-slate-800 text-sm">{chats.find(c=>c.id===activeChat)?.name || activeChat}</h3></div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar relative z-0">
                      {chatMessages.map(m => (
                        <div key={m.id} className={`flex ${m.fromMe?'justify-end':'justify-start'} animate-fade-in`}><div className={`p-3 rounded-2xl text-xs max-w-[70%] shadow-sm ${m.fromMe?'bg-[#d9fdd3] text-slate-800 rounded-tr-none':'bg-white text-slate-800 rounded-tl-none'}`}>{m.body}<div className="text-[9px] text-slate-400 text-right mt-1 font-mono">{new Date(m.timestamp * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div></div></div>
                      ))}
                    </div>
                    <div className="p-4 bg-white/95 border-t flex gap-3 z-10 items-center">
                      <input className="flex-1 bg-slate-100 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-brand-500/20" placeholder="Mensagem..." value={newMessage} onChange={e=>setNewMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} />
                      <button onClick={sendMessage} className={`p-2.5 rounded-xl transition-all ${newMessage.trim()?'bg-brand-600 text-white shadow-lg shadow-brand-600/30 scale-105':'bg-slate-200 text-slate-400'}`}><Send size={20} /></button>
                    </div>
                  </>
                ) : <div className="flex-1 flex flex-col items-center justify-center text-slate-300 relative z-10 p-10 text-center"><div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center text-brand-200 mb-6"><MessageSquare size={40}/></div><h3 className="text-xl font-bold text-slate-400 uppercase tracking-widest">Selecione uma conversa</h3></div>}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <div className="card-premium p-8 space-y-6 bg-white shadow-xl">
                <div className="flex items-center gap-3 pb-4 border-b">
                  <div className="p-2 bg-brand-50 text-brand-600 rounded-lg"><Settings size={20}/></div>
                  <h3 className="font-black text-slate-800 uppercase tracking-tight">Inteligência Artificial</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Provedor</label><select className="input-premium h-12" value={aiConfig.provider} onChange={e=>setAiConfig({...aiConfig, provider:e.target.value as any})}><option value="gemini">Google Gemini (API Key Automática)</option><option value="groq">Groq (Llama 3)</option></select></div>
                  {aiConfig.provider === 'groq' && <div className="space-y-2 animate-fade-in"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Groq API Key</label><input className="input-premium h-12" type="password" value={aiConfig.apiKeys.groq} onChange={e=>setAiConfig({...aiConfig, apiKeys:{...aiConfig.apiKeys, groq:e.target.value}})} /></div>}
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Modelo</label><select className="input-premium h-12" value={aiConfig.model} onChange={e=>setAiConfig({...aiConfig, model:e.target.value})}>{aiConfig.provider === 'gemini' ? <><option value="gemini-3-flash-preview">Gemini 3 Flash</option><option value="gemini-3-pro-preview">Gemini 3 Pro</option></> : <><option value="llama-3.1-70b-versatile">Llama 3.1 70B</option><option value="llama-3.1-8b-instant">Llama 3.1 8B</option></>}</select></div>
                  <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-1">Personalidade</label><textarea className="input-premium h-40 text-sm" value={aiConfig.persona} onChange={e=>setAiConfig({...aiConfig, persona:e.target.value})} /></div>
                </div>
                <button onClick={()=>saveAiConfig(aiConfig)} className="btn-primary w-full h-12 text-lg uppercase tracking-widest font-black shadow-brand-600/20" disabled={isSavingConfig}>{isSavingConfig ? 'Salvando...' : 'Salvar Configurações'}</button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Campaign Details Modal */}
      {viewingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl animate-slide-up">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50/80">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand-600 text-white rounded-2xl flex items-center justify-center shadow-lg"><Rocket size={24}/></div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{viewingCampaign.name}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{viewingCampaign.description || 'Monitoramento de Campanha'}</p>
                      </div>
                    </div>
                    <button onClick={() => setViewingCampaign(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors"><X size={24}/></button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100/80 sticky top-0 z-10 backdrop-blur-md">
                          <tr><th className="px-6 py-4 font-black text-slate-500 uppercase border-b">Empresa / CNPJ</th><th className="px-6 py-4 font-black text-slate-500 uppercase border-b">Cidade</th><th className="px-6 py-4 font-black text-slate-500 uppercase border-b">Status WA</th><th className="px-6 py-4 font-black text-slate-500 uppercase border-b">Último Contato</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {campaignLeads.map(lead => (
                                <tr key={lead.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4"><div className="font-black text-slate-800">{lead.razaoSocial}</div><div className="text-[10px] text-slate-400 mt-0.5">{lead.cnpj}</div></td>
                                    <td className="px-6 py-4 text-slate-600 font-medium">{lead.municipio}</td>
                                    <td className="px-6 py-4"><StatusBadge status={lead.campaignStatus} /></td>
                                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase">{lead.lastContacted ? new Date(lead.lastContacted).toLocaleString() : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-6 border-t bg-slate-50/50 flex justify-end">
                    <button onClick={() => setViewingCampaign(null)} className="btn-secondary h-11 px-8 font-black uppercase text-xs tracking-widest">Fechar Painel</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
