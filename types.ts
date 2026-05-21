

export enum Status {
  SUCCESS = 'Sucesso',
  ERROR = 'Erro',
  PENDING = 'Pendente',
  PROCESSING = 'Processando'
}

export enum CampaignStatus {
  PENDING = 'pending',     
  QUEUED = 'queued',       
  SENT = 'sent',           
  DELIVERED = 'delivered', 
  READ = 'read',           
  REPLIED = 'replied',     
  INTERESTED = 'interested', 
  NOT_INTERESTED = 'not_interested',
  ERROR = 'error',
  SKIPPED = 'skipped'
}

export interface CompanyResult {
  id: string;
  consultaId?: string; 
  inscricaoEstadual: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  unidadeFiscalizacao?: string;
  logradouro?: string;
  bairroDistrito?: string;
  municipio: string;
  uf?: string;
  cep?: string;
  telefone: string | null;
  email?: string;
  atividadeEconomicaPrincipal?: string;
  condicao?: string;
  formaPagamento?: string;
  wa_id?: string;
  situacaoCadastral: string;
  dataSituacaoCadastral?: string;
  motivoSituacao: string;
  nomeContador: string | null;
  status: Status;
  
  // Campaign Fields
  campaignStatus: string; 
  lastContacted?: string;
  lastMessageSent?: string;
  aiAnalysis?: string;
  aiActive?: boolean; 
  campaignName?: string;
}

export interface ProcessingStats {
  total: number;
  processed: number;
  success: number;
  errors: number;
}

export interface Instruction {
  id: string;
  title: string;      
  type: 'simple' | 'flow';
  content: string;    
}

export interface KnowledgeRule {
  id: string;
  motivoSituacao: string; 
  instructions: Instruction[];
  regularizationProcess?: string;
  requiredInfo?: string;
  reasonExplanation?: string;
  defaultResponse?: string;
  prazos?: string;         // Adicionado
  valores?: string;        // Adicionado
  flowNodes?: any[];
  flowEdges?: any[];
  isActive: boolean;
}

export interface AIConfig {
  provider: 'gemini' | 'groq';
  apiKeys: {
    gemini?: string;
    groq?: string;
  };
  model: string;
  persona: string;
  knowledgeRules: KnowledgeRule[];
  temperature: number;
  aiActive: boolean;
}

export interface WhatsAppSession {
  status: 'connected' | 'disconnected' | 'qr_ready' | 'connecting';
  qrCode?: string;
  userName?: string;
  phoneNumber?: string;
}

export interface ImportBatch {
  id: string;
  filename: string;
  date: string;
  total: number;
  processed: number;
  status: string;
}