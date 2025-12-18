
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, Upload, MessageCircle, Bot, Settings, Menu, FileSpreadsheet, Search,
  CheckCircle2, AlertCircle, Send, RefreshCw, BookOpen, Plus, Trash2,
  Briefcase, MessageSquare, User, Paperclip, Mic, X, Save,
  BarChart3, Rocket, Sparkles, CheckSquare, Square, Trello, MoreHorizontal, PauseCircle, PlayCircle, Edit,
  ToggleLeft, ToggleRight, Power, Phone, MoreVertical, Smile, Paperclip as PaperclipIcon, Check, Eye, EyeOff, Cpu
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

const cleanReasonText = (text: string | null | undefined) => {
    if (!text) return '';
    return text.split('Endereço de Correspondência')[0].split('Endereço:')[0].split('Endereco de Correspondencia')[0].trim();
};

const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    return new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, string> = { 'pending': 'bg-slate-100 text-slate-600', 'queued': 'bg-amber-100 text-amber-700', 'sent': 'bg-blue-100 text-blue-700', 'replied': 'bg-purple-100 text-purple-700', 'interested': 'bg-emerald-100 text-emerald-700', 'not_interested': 'bg-rose-100 text-rose-700', 'error': 'bg-red-100 text-red-700', 'skipped': 'bg-gray-100 text-gray-500' };
    const labels: Record<string, string> = { 'pending': 'Pendente', 'queued': 'Fila', 'sent': 'Enviado', 'replied': 'Respondeu', 'interested': 'Interessado', 'not_interested': 'Descartado', 'error': 'Erro', 'skipped': 'Sem Zap' };
    return <span className={`px-2 py-1 rounded-full text-xs font-bold ${map[status] || map['pending']}`}>{labels[status] || status}</span>;
}

const FilterBar = React.memo(({ filters, setFilters, availableCities, availableReasons, onRefresh }: any) => (
  <div className="card-premium p-4 flex flex-col gap-4 mb-6">
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input type="text" placeholder="Buscar..." className="input-premium pl-10" value={filters.search} onChange={e => setFilters((p: any) => ({...p, search: e.target.value}))} />
      </div>
      <button onClick={onRefresh} className="btn-secondary px-3"><RefreshCw size={20} /></button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <select className="input-premium py-2 text-sm" value={filters.city} onChange={e => setFilters((p: any) => ({...p, city: e.target.value}))}><option value="">Cidades</option>{availableCities.map((c: string) => <option key={c} value={c}>{c}</option>)}</select>
      <select className="input-premium py-2 text-sm" value={filters.reason} onChange={e => setFilters((p: any) => ({...p, reason: e.target.value}))}><option value="">Motivos</option>{availableReasons.map((r: string) => <option key={r} value={r}>{r}</option>)}</select>
      <select className="input-premium py-2 text-sm" value={filters.statusWa} onChange={e => setFilters((p: any) => ({...p, statusWa: e.target.value}))}><option value="all">Status</option><option value="sent">Enviado</option><option value="replied">Respondeu</option></select>
      <select className="input-premium py-2 text-sm" value={filters.hasPhone} onChange={e => setFilters((p: any) => ({...p, hasPhone: e.target.value}))}><option value="all">Telefone</option><option value="yes">Com</option><option value="no">Sem</option></select>
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
  const [selectedKanbanLead, setSelectedKanbanLead] = useState<CompanyResult | null>(null);
  const [viewingCampaign, setViewingCampaign] = useState<any | null>(null);
  const [campaignLeads, setCampaignLeads] = useState<CompanyResult[]>([]);
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);
  const [campaignStep, setCampaignStep] = useState(1);
  const [newCampaign, setNewCampaign] = useState({ name: '', description: '', initialMessage: 'Olá, tudo bem?', aiPersona: DEFAULT_AI_PERSONA });
  const [aiConfig, setAiConfig] = useLocalStorage<AIConfig>('crm_ai_config', { model: 'gemini-3-flash-preview', provider: 'gemini', apiKeys: { gemini: '', groq: '' }, persona: DEFAULT_AI_PERSONA, knowledgeRules: [], temperature: 0.7, aiActive: true });
  const [editingRule, setEditingRule] = useState<KnowledgeRule | null>(null);
  const [waSession, setWaSession] = useState<WhatsAppSession>({ status: 'disconnected' });
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => { fetchCompanies(); fetchImports(); fetchFilters(); fetchCampaigns(); fetchAiConfig(); }, []);
  useInterval(() => { fetchWhatsAppStatus(); if (activeTab === 'whatsapp' && waSession.status === 'connected') { fetchChats(); if (activeChat) fetchMessages(activeChat); } }, 3000);
  useInterval(() => {
    if (currentProcessId) {
      fetch(`/progress/${currentProcessId}`).then(res => res.body?.getReader()?.read()).then(({ value }) => {
        if (value) {
            const data = JSON.parse(new TextDecoder().decode(value).split('\n\n')[0].replace('data: ', ''));
            setProcessProgress(data);
            if (data.status === 'completed' || data.status === 'error') { fetchCompanies(); fetchImports(); fetchFilters(); setTimeout(() => setCurrentProcessId(null), 3000); }
        }
      });
    }
  }, currentProcessId ? 1000 : null);

  const fetchAiConfig = async () => { try { const res = await fetch('/api/config'); if (res.ok) setAiConfig(await res.json()); } catch (e) {} };
  const fetchFilters = async () => { try { const res = await fetch('/api/unique-filters'); if (res.ok) { const d = await res.json(); setAvailableCities(d.municipios); setAvailableReasons(d.motivos); } } catch (e) {} };
  const fetchCampaigns = async () => { try { const res = await fetch('/api/campaigns'); if (res.ok) setCampaigns(await res.json()); } catch (e) {} };
  const fetchCompanies = async () => { try { const res = await fetch('/get-all-results'); if (res.ok) { const d = await res.json(); setCompanies(d); setStats({ total: d.length, processed: d.length, success: d.filter((c:any) => c.status === 'Sucesso').length, errors: d.filter((c:any) => c.status !== 'Sucesso').length }); } } catch (e) {} };
  const fetchImports = async () => { try { const res = await fetch('/get-imports'); if (res.ok) setImports(await res.json()); } catch (e) {} };
  const fetchWhatsAppStatus = async () => { try { const res = await fetch('/api/whatsapp/status'); if (res.ok) { const d = await res.json(); setWaSession({ status: d.status, qrCode: d.qr }); } } catch (e) {} };
  const fetchChats = async () => { try { const res = await fetch('/api/whatsapp/chats'); if (res.ok) setChats(await res.json()); } catch (e) {} };
  const fetchMessages = async (id: string) => { try { const res = await fetch(`/api/whatsapp/messages/${id}`); if (res.ok) setChatMessages(await res.json()); } catch (e) {} };
  const fetchCampaignLeads = async (id: string) => { try { const res = await fetch(`/api/campaigns/${id}/leads`); if (res.ok) setCampaignLeads(await res.json()); } catch (e) {} };

  // Fix: Added missing sendMessage function to handle outgoing messages via the WhatsApp API
  const sendMessage = async () => {
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
    } catch (e) {
      console.error('Failed to send message:', e);
    }
  };

  const saveAiConfig = async (conf: AIConfig) => {
    setIsSavingConfig(true);
    try { const res = await fetch('/api/config/ai-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules: conf.knowledgeRules, persona: conf.persona, temperature: conf.temperature, model: conf.model, aiActive: conf.aiActive, provider: conf.provider, apiKeys: conf.apiKeys }) }); if (res.ok) setAiConfig(await res.json()); } catch (e) {} finally { setIsSavingConfig(false); }
  };

  const createCampaign = async () => {
    try {
      const res = await fetch('/api/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newCampaign, leads: Array.from(selectedIds) }) });
      if (res.ok) { setIsCreatingCampaign(false); fetchCampaigns(); fetchCompanies(); }
    } catch (e) {}
  };

  const deleteCampaign = async (id: string) => { if (confirm('Excluir?')) { try { await fetch(`/api/campaigns/${id}`, { method: 'DELETE' }); fetchCampaigns(); fetchCompanies(); } catch (e) {} } };
  const deleteImport = async (id: string) => { if (confirm('Excluir?')) { try { await fetch(`/api/imports/${id}`, { method: 'DELETE' }); fetchImports(); fetchCompanies(); } catch (e) {} } };

  const filteredCompanies = useMemo(() => companies.filter(c => {
    const s = !filters.search || c.razaoSocial?.toLowerCase().includes(filters.search.toLowerCase()) || c.inscricaoEstadual?.includes(filters.search);
    const ct = !filters.city || c.municipio === filters.city;
    const ph = filters.hasPhone === 'all' ? true : filters.hasPhone === 'yes' ? !!c.telefone : !c.telefone;
    return s && ct && ph;
  }), [companies, filters]);

  const toggleSelection = (id: string) => { const n = new Set(selectedIds); if (n.has(id)) n.delete(id); else n.add(id); setSelectedIds(n); };
  const toggleSelectAll = () => setSelectedIds(selectedIds.size === filteredCompanies.length ? new Set() : new Set(filteredCompanies.map(c => c.id)));

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans">
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-brand-950 text-white transition-all flex flex-col shadow-2xl z-20`}>
        <div className="p-4 flex items-center justify-between border-b border-brand-800/50">
          <div className="flex items-center gap-2 overflow-hidden"><div className="w-8 h-8 bg-brand-500 rounded flex items-center justify-center font-bold">V</div>{isSidebarOpen && <span className="font-bold">CRM VÍRGULA</span>}</div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 hover:bg-brand-800 rounded"><Menu size={18} /></button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {[{ id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' }, { id: 'kanban', icon: Trello, label: 'Kanban Vendas' }, { id: 'import', icon: Upload, label: 'Importar PDF' }, { id: 'companies', icon: FileSpreadsheet, label: 'Base' }, { id: 'campaigns', icon: Rocket, label: 'Campanhas' }, { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp' }, { id: 'knowledge', icon: BookOpen, label: 'Conhecimento' }, { id: 'settings', icon: Settings, label: 'Configurações' }].map(i => (
            <button key={i.id} onClick={() => setActiveTab(i.id)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${activeTab === i.id ? 'bg-brand-600 text-white' : 'text-brand-200 hover:bg-brand-900/50 hover:text-white'}`}>
              <i.icon size={20} />{isSidebarOpen && <span className="text-sm flex-1 text-left">{i.label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between"><h1 className="text-2xl font-bold text-slate-800 capitalize">{activeTab}</h1></header>
        <div className="p-8 max-w-[1600px] mx-auto pb-20">
          {activeTab === 'dashboard' && <div className="grid grid-cols-4 gap-6">{[{l:'Total',v:stats.total},{l:'Sucesso',v:stats.success},{l:'Erro',v:stats.errors},{l:'Campanhas',v:campaigns.length}].map((s,i) => <div key={i} className="card-premium p-6"><p className="text-sm font-medium text-slate-500">{s.l}</p><h3 className="text-3xl font-bold text-slate-700">{s.v}</h3></div>)}</div>}

          {activeTab === 'import' && (
            <div className="space-y-6">
              {!currentProcessId ? (
                <div className="max-w-xl mx-auto card-premium p-10 text-center border-2 border-dashed border-slate-300 relative">
                  <input type="file" accept=".pdf" className="absolute inset-0 opacity-0 cursor-pointer" onChange={async (e) => { const f = e.target.files?.[0]; if(f) { const fd = new FormData(); fd.append('file', f); const r = await fetch('/start-processing', { method:'POST', body:fd }); if(r.ok) setCurrentProcessId((await r.json()).processId); } }} />
                  <Upload size={40} className="mx-auto mb-4 text-brand-500" /><h3>Nova Importação</h3>
                </div>
              ) : <div className="max-w-md mx-auto card-premium p-6 text-center animate-pulse"><RefreshCw className="animate-spin mx-auto mb-4" /><h3>Processando: {processProgress.processed} / {processProgress.total}</h3></div>}
              <div className="card-premium p-6">
                <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th>Arquivo</th><th>Data</th><th>Total</th><th className="text-right">Ação</th></tr></thead><tbody>{imports.map(i => <tr key={i.id}><td>{i.filename}</td><td>{new Date(i.date).toLocaleDateString()}</td><td>{i.total}</td><td className="text-right"><button onClick={() => deleteImport(i.id)} className="text-rose-500"><Trash2 size={16}/></button></td></tr>)}</tbody></table>
              </div>
            </div>
          )}

          {activeTab === 'companies' && (
            <div className="space-y-4">
              <FilterBar filters={filters} setFilters={setFilters} availableCities={availableCities} availableReasons={availableReasons} onRefresh={fetchCompanies} />
              <div className="card-premium overflow-x-auto"><table className="w-full text-sm text-left"><thead><tr className="bg-slate-50 text-slate-500 font-medium"><th>Empresa</th><th>Status WA</th><th>Município</th></tr></thead><tbody>{filteredCompanies.map(c => <tr key={c.id} className="border-b hover:bg-slate-50"><td>{c.razaoSocial}</td><td><StatusBadge status={c.campaignStatus} /></td><td>{c.municipio}</td></tr>)}</tbody></table></div>
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div className="space-y-6">
               {!isCreatingCampaign ? (
                 <>
                   <div className="flex justify-between items-center"><h2 className="text-xl font-bold">Minhas Campanhas</h2><button onClick={() => setIsCreatingCampaign(true)} className="btn-primary flex items-center gap-2"><Plus size={18}/> Nova</button></div>
                   <div className="grid grid-cols-3 gap-6">
                     {campaigns.map(c => (
                       <div key={c.id} onClick={() => { setViewingCampaign(c); fetchCampaignLeads(c.id); }} className="card-premium p-6 cursor-pointer hover:border-brand-300 transition-all relative group">
                         <button onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id); }} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 group-hover:opacity-100 opacity-0 transition-all"><Trash2 size={18}/></button>
                         <h3 className="font-bold text-lg mb-4">{c.name}</h3>
                         <div className="grid grid-cols-3 gap-2 text-center border-t pt-4"><div><p className="text-xs text-slate-400">Total</p><p className="font-bold">{c.stats?.total || 0}</p></div><div><p className="text-xs text-slate-400">Enviados</p><p className="font-bold text-brand-600">{c.stats?.sent || 0}</p></div><div><p className="text-xs text-slate-400">Respostas</p><p className="font-bold text-emerald-600">{c.stats?.replied || 0}</p></div></div>
                       </div>
                     ))}
                   </div>
                 </>
               ) : (
                 <div className="max-w-4xl mx-auto card-premium p-8">
                   <div className="flex justify-between mb-8"><h2 className="text-xl font-bold">Criar Campanha</h2><button onClick={() => setIsCreatingCampaign(false)}><X/></button></div>
                   {campaignStep === 1 && <div className="space-y-4"><input className="input-premium" placeholder="Nome" value={newCampaign.name} onChange={e=>setNewCampaign({...newCampaign, name:e.target.value})} /><textarea className="input-premium h-24" placeholder="Descrição" value={newCampaign.description} onChange={e=>setNewCampaign({...newCampaign, description:e.target.value})} /><button onClick={()=>setCampaignStep(2)} className="btn-primary w-full">Próximo</button></div>}
                   {campaignStep === 2 && <div className="space-y-4"><div className="h-96 overflow-y-auto border rounded"><table className="w-full text-xs"><thead><tr className="bg-slate-50"><th className="p-2"><button onClick={toggleSelectAll}>All</button></th><th className="p-2">Empresa</th></tr></thead><tbody>{filteredCompanies.map(c=><tr key={c.id} className="border-b"><td><input type="checkbox" checked={selectedIds.has(c.id)} onChange={()=>toggleSelection(c.id)} /></td><td>{c.razaoSocial}</td></tr>)}</tbody></table></div><div className="flex justify-between"><button onClick={()=>setCampaignStep(1)} className="btn-secondary">Voltar</button><button onClick={()=>setCampaignStep(3)} className="btn-primary" disabled={selectedIds.size===0}>Próximo ({selectedIds.size})</button></div></div>}
                   {campaignStep === 3 && <div className="space-y-4"><textarea className="input-premium h-48" value={newCampaign.initialMessage} onChange={e=>setNewCampaign({...newCampaign, initialMessage:e.target.value})} /><button onClick={createCampaign} className="btn-primary w-full">Disparar</button></div>}
                 </div>
               )}
            </div>
          )}

          {activeTab === 'whatsapp' && (
            <div className="flex h-[calc(100vh-180px)] gap-6">
              <div className="w-1/3 card-premium flex flex-col bg-white">
                <div className="p-4 border-b font-bold flex justify-between">Conversas <span className={`w-3 h-3 rounded-full ${waSession.status==='connected'?'bg-emerald-500':'bg-rose-500'}`}></span></div>
                <div className="flex-1 overflow-y-auto">{waSession.qrCode && waSession.status!=='connected' ? <div className="p-10 text-center"><img src={waSession.qrCode} className="mx-auto mb-4 w-48" /><p className="animate-pulse">Aguardando Conexão...</p></div> : chats.map(c => <div key={c.id} onClick={()=>{setActiveChat(c.id);fetchMessages(c.id);}} className={`p-4 border-b hover:bg-slate-50 cursor-pointer ${activeChat===c.id?'bg-brand-50':''}`}><div className="font-bold text-sm truncate">{c.name || c.id}</div><div className="text-xs text-slate-500 truncate">{c.lastMessage}</div></div>)}</div>
              </div>
              <div className="flex-1 card-premium flex flex-col bg-[#efeae2] relative">
                {activeChat ? <><div className="p-4 bg-white/90 border-b flex justify-between items-center z-10"><h3 className="font-bold">{chats.find(c=>c.id===activeChat)?.name || activeChat}</h3></div><div className="flex-1 overflow-y-auto p-4 space-y-3">{chatMessages.map(m=><div key={m.id} className={`flex ${m.fromMe?'justify-end':'justify-start'}`}><div className={`p-2 rounded-lg text-sm max-w-[80%] ${m.fromMe?'bg-[#d9fdd3]':'bg-white'}`}>{m.body}</div></div>)}</div><div className="p-3 bg-[#f0f2f5] flex gap-2"><input className="flex-1 p-2 rounded-xl outline-none" value={newMessage} onChange={e=>setNewMessage(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()} /><button onClick={()=>sendMessage()} className="btn-primary p-2 rounded-full"><Send size={20}/></button></div></> : <div className="flex-1 flex items-center justify-center text-slate-400">Selecione um chat</div>}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="card-premium p-6 space-y-4">
                <h3>Configurações de IA</h3>
                <select className="input-premium" value={aiConfig.provider} onChange={e=>setAiConfig({...aiConfig, provider:e.target.value as any})}>
                  <option value="gemini">Gemini</option>
                  <option value="groq">Groq</option>
                </select>
                {/* Fix: Gemini API key input removed to comply with mandated SDK guidelines. It is strictly obtained from process.env.API_KEY on the server. */}
                {aiConfig.provider === 'groq' && (
                  <input className="input-premium" type="password" placeholder="Groq API Key" value={aiConfig.apiKeys.groq} onChange={e=>setAiConfig({...aiConfig, apiKeys:{...aiConfig.apiKeys, groq:e.target.value}})} />
                )}
                <button onClick={()=>saveAiConfig(aiConfig)} className="btn-primary w-full" disabled={isSavingConfig}>{isSavingConfig?'Salvando...':'Salvar'}</button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Campaign Details Modal */}
      {viewingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden animate-slide-up">
                <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                    <div><h3 className="text-xl font-bold">{viewingCampaign.name}</h3><p className="text-sm text-slate-500">{viewingCampaign.description}</p></div>
                    <button onClick={() => setViewingCampaign(null)} className="p-2 hover:bg-slate-200 rounded-full"><X/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 sticky top-0"><tr><th className="px-4 py-2">Empresa</th><th className="px-4 py-2">Telefone</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Último Contato</th></tr></thead>
                        <tbody className="divide-y">
                            {campaignLeads.length > 0 ? campaignLeads.map(lead => (
                                <tr key={lead.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium">{lead.razaoSocial}</td>
                                    <td className="px-4 py-3 text-slate-500">{lead.telefone || '-'}</td>
                                    <td className="px-4 py-3"><StatusBadge status={lead.campaignStatus} /></td>
                                    <td className="px-4 py-3 text-xs text-slate-400">{lead.lastContacted ? new Date(lead.lastContacted).toLocaleString() : '-'}</td>
                                </tr>
                            )) : <tr><td colSpan={4} className="p-10 text-center text-slate-400">Carregando leads...</td></tr>}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-end"><button onClick={() => setViewingCampaign(null)} className="btn-secondary">Fechar</button></div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
