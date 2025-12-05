
export enum Status {
  SUCCESS = 'Sucesso',
  ERROR = 'Erro',
  PENDING = 'Pendente',
  PROCESSING = 'Processando'
}

export enum CampaignStatus {
  PENDING = 'pending',     // Not contacted yet
  QUEUED = 'queued',       // In sending queue
  SENT = 'sent',           // Message sent
  DELIVERED = 'delivered', // Double check
  READ = 'read',           // Blue tick
  REPLIED = 'replied',     // Customer answered
  INTERESTED = 'interested', // Lead conversion
  NOT_INTERESTED = 'not_interested' // Lead lost
}

export interface CompanyResult {
  id: string;
  consultaId?: string; // Link to the import batch
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
  campaignStatus: CampaignStatus;
  lastContacted?: string;
  lastMessageSent?: string;
  aiAnalysis?: string;
}

export interface ProcessingStats {
  total: number;
  processed: number;
  success: number;
  errors: number;
}

export interface Instruction {
  id: string;
  title: string;      // Ex: "Argumento de Preço", "Passo a Passo"
  type: 'simple' | 'flow';
  content: string;    // O texto para a IA
}

export interface KnowledgeRule {
  id: string;
  motivoSituacao: string; // The Trigger
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
