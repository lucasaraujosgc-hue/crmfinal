
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
  municipio: string;
  telefone: string | null;
  situacaoCadastral: string;
  motivoSituacao: string;
  nomeContador: string | null;
  status: Status;
  
  // Campaign Fields
  campaignStatus: string; // Using string to allow DB values easily
  lastContacted?: string;
  lastMessageSent?: string;
  aiAnalysis?: string;
  aiActive?: boolean; // New field for per-contact AI toggle
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
  isActive: boolean;
}

export interface AIConfig {
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
  status: string;
}