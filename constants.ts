
import { CompanyResult, Status, CampaignStatus, KnowledgeRule } from './types';

export const MOCK_DATA: CompanyResult[] = [
  {
    id: '1',
    inscricaoEstadual: '083.456.789-00',
    cnpj: '12.345.678/0001-90',
    razaoSocial: 'MERCADINHO DO JOAO LTDA',
    municipio: 'SALVADOR',
    telefone: '5571988776655',
    situacaoCadastral: 'INAPTA',
    motivoSituacao: 'Art. 27 - Inc. XVIII - MEI',
    nomeContador: null,
    status: Status.SUCCESS,
    campaignStatus: CampaignStatus.PENDING,
  },
  {
    id: '2',
    inscricaoEstadual: '099.123.456-11',
    cnpj: '98.765.432/0001-10',
    razaoSocial: 'PADARIA SABOR DA BAHIA',
    municipio: 'FEIRA DE SANTANA',
    telefone: '5575999887766',
    situacaoCadastral: 'ATIVA',
    motivoSituacao: 'Regular', // Situação normal
    nomeContador: 'MARIA SILVA CONTABILIDADE',
    status: Status.SUCCESS,
    campaignStatus: CampaignStatus.SENT,
    lastContacted: '2023-10-25T14:30:00Z',
    lastMessageSent: 'Olá, percebi que sua empresa está ativa, mas temos oportunidades tributárias...'
  },
  {
    id: '3',
    inscricaoEstadual: '077.555.444-22',
    cnpj: '45.123.789/0001-55',
    razaoSocial: 'CONSTRUCOES E REFORMAS LTDA',
    municipio: 'VITORIA DA CONQUISTA',
    telefone: null,
    situacaoCadastral: 'SUSPENSA',
    motivoSituacao: 'Art.27, inc XIX, a, Omisso EFD',
    nomeContador: null,
    status: Status.SUCCESS,
    campaignStatus: CampaignStatus.PENDING,
  },
  {
    id: '4',
    inscricaoEstadual: '112.223.334-55',
    cnpj: '33.444.555/0001-22',
    razaoSocial: 'TECH SOLUTIONS INFORMATICA',
    municipio: 'CAMACARI',
    telefone: '5571991112222',
    situacaoCadastral: 'INAPTA',
    motivoSituacao: 'Art. 27 - Inc. I - Não Localizado',
    nomeContador: null,
    status: Status.SUCCESS,
    campaignStatus: CampaignStatus.REPLIED,
    lastContacted: '2023-10-24T09:15:00Z',
    lastMessageSent: 'A fiscalização não encontrou sua empresa. Podemos ajudar com a defesa.'
  },
];

export const DEFAULT_AI_PERSONA = `Você é Lucas, um consultor tributário sênior especializado em regularização de empresas na Bahia (SEFAZ/BA).
Seu objetivo é agendar uma reunião ou iniciar uma conversa para oferecer serviços de regularização.

DIRETRIZES DE TOM:
1. Profissional, mas acessível e empático.
2. Direto ao ponto: use as informações da "Base de Conhecimento" para explicar o problema.
3. Não use "juridiquês" excessivo, explique de forma que o dono da empresa entenda.
4. Finalize sempre com uma pergunta aberta para estimular resposta.`;

export const DEFAULT_KNOWLEDGE_RULES: KnowledgeRule[] = [
  {
    id: '1',
    motivoSituacao: 'Art. 27 - Inc. XVIII - MEI',
    instructions: [
      {
        id: 'inst-1-1',
        title: 'Diagnóstico',
        type: 'simple',
        content: 'O MEI ultrapassou o limite de faturamento ou de compras (20% acima do limite permito). A SEFAZ bloqueou a inscrição para impedir novas compras.'
      },
      {
        id: 'inst-1-2',
        title: 'Solução',
        type: 'simple',
        content: 'É necessário realizar o desenquadramento do MEI e a migração para o Simples Nacional, além de apurar os impostos retroativos sobre o excesso.'
      },
      {
        id: 'inst-1-3',
        title: 'Argumento de Venda',
        type: 'simple',
        content: 'Sua empresa cresceu e a SEFAZ travou suas compras. Se não regularizarmos agora, a dívida aumenta. Eu resolvo essa migração para o Simples Nacional rapidamente para você voltar a operar.'
      }
    ],
    isActive: true
  },
  {
    id: '2',
    motivoSituacao: 'Art.27, inc XIX, a, Omisso EFD',
    instructions: [
      {
        id: 'inst-2-1',
        title: 'Diagnóstico',
        type: 'simple',
        content: 'Falta de envio da Escrituração Fiscal Digital (EFD) por 2 meses ou mais consecutivos.'
      },
      {
        id: 'inst-2-2',
        title: 'Solução',
        type: 'simple',
        content: 'Envio imediato dos arquivos Sped Fiscal pendentes e verificação de multas por atraso.'
      },
      {
        id: 'inst-2-3',
        title: 'Argumento de Venda',
        type: 'simple',
        content: 'Identifiquei que faltam declarações fiscais da sua empresa. Isso suspende sua inscrição e gera multas diárias. Consigo transmitir esses arquivos hoje e destravar sua empresa.'
      }
    ],
    isActive: true
  },
  {
    id: '3',
    motivoSituacao: 'Art. 27 - Inc. I - Não Localizado',
    instructions: [
      {
        id: 'inst-3-1',
        title: 'Diagnóstico',
        type: 'simple',
        content: 'A fiscalização foi ao endereço cadastrado no CNPJ e não encontrou a empresa funcionando.'
      },
      {
        id: 'inst-3-2',
        title: 'Solução',
        type: 'simple',
        content: 'Atualização cadastral de endereço (REDESIM) ou defesa administrativa comprovando o funcionamento no local (fotos, contas de consumo).'
      },
      {
        id: 'inst-3-3',
        title: 'Argumento de Venda',
        type: 'simple',
        content: 'A fiscalização bateu na sua porta e não te encontrou, por isso inativaram sua Inscrição. Precisamos atualizar seu endereço na SEFAZ urgente ou apresentar defesa, senão o CNPJ será baixado.'
      }
    ],
    isActive: true
  }
];
