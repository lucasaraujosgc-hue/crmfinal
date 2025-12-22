import './polyfill.js'; // IMPORTANTE: Deve ser a primeira importação
import 'dotenv/config';
import express from 'express';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import fs from 'fs';
import { GoogleGenAI } from "@google/genai";
import { Groq } from 'groq-sdk';
import multer from 'multer';
import sqlite3 from 'sqlite3';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

const activeScrapes = new Map();

const DATA_DIR = process.env.DATA_PATH || path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const AUTH_DIR = path.join(DATA_DIR, 'whatsapp_auth');
const DB_PATH = path.join(DATA_DIR, 'consultas.db');
const AI_CONFIG_PATH = path.join(DATA_DIR, 'ai-config.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR });
const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS consulta (
    id TEXT PRIMARY KEY,
    filename TEXT,
    total INTEGER,
    processed INTEGER,
    status TEXT,
    start_time TEXT,
    end_time TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS campaign (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    initial_message TEXT,
    ai_persona TEXT,
    status TEXT,
    created_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS resultado (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consulta_id TEXT,
    campaign_id TEXT,
    inscricao_estadual TEXT,
    cnpj TEXT,
    razao_social TEXT,
    nome_fantasia TEXT,
    unidade_fiscalizacao TEXT,
    logradouro TEXT,
    bairro_distrito TEXT,
    municipio TEXT,
    uf TEXT,
    cep TEXT,
    telefone TEXT,
    wa_id TEXT,
    email TEXT,
    atividade_economica_principal TEXT,
    condicao TEXT,
    forma_pagamento TEXT,
    situacao_cadastral TEXT,
    data_situacao_cadastral TEXT,
    motivo_situacao_cadastral TEXT,
    nome_contador TEXT,
    status TEXT,
    campaign_status TEXT DEFAULT 'pending',
    last_contacted TEXT,
    ai_active INTEGER DEFAULT 1, 
    FOREIGN KEY(consulta_id) REFERENCES consulta(id),
    FOREIGN KEY(campaign_id) REFERENCES campaign(id)
  )`);
});

let aiConfig = {
  provider: 'gemini',
  apiKeys: { gemini: '', groq: '' },
  model: 'gemini-3-flash-preview',
  persona: 'Você é um assistente útil.',
  knowledgeRules: [], 
  temperature: 0.7,
  aiActive: true
};

if (fs.existsSync(AI_CONFIG_PATH)) {
    try {
        const savedConfig = JSON.parse(fs.readFileSync(AI_CONFIG_PATH, 'utf8'));
        aiConfig = { ...aiConfig, ...savedConfig };
    } catch (e) { console.error(e); }
} else {
    fs.writeFileSync(AI_CONFIG_PATH, JSON.stringify(aiConfig, null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// Função para detectar se a mensagem é um auto-reply do WhatsApp Business do lead
function isAutoReply(text) {
    if (!text) return false;
    const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove acentos
    const patterns = [
        /posso (te|lhe) ajuda/i,
        /que posso (te|lhe) ajuda/i,
        /como posso (te|lhe) ajuda/i,
        /mensagem automatica/i,
        /assistente virtual/i,
        /horario de atendimento/i,
        /ola, tudo bem/i,
        /^ola[!,.]?$/i,
        /^oi[!,.]?$/i
    ];
    return patterns.some(p => p.test(lower));
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  },
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  }
});

let qrCodeData = null;
let clientReady = false;

client.on('qr', (qr) => QRCode.toDataURL(qr, (err, url) => qrCodeData = url));
client.on('ready', () => { console.log('WhatsApp Conectado!'); clientReady = true; });

client.on('message', async (msg) => {
    if (msg.fromMe || msg.from.includes('status@broadcast') || msg.from.includes('@g.us')) return;
    if (!aiConfig.aiActive) return;

    // --- FILTRO DE AUTO-REPOSTA ---
    if (isAutoReply(msg.body)) {
        console.log(`[WA] Auto-reply ignorado: "${msg.body}"`);
        return;
    }

    let waId = msg.from;
    let cleanSenderPhone = "";
    try {
        const contact = await msg.getContact();
        cleanSenderPhone = (contact.number || contact.id.user || msg.from.split('@')[0]).replace(/\D/g, '');
    } catch(e) {
        cleanSenderPhone = msg.from.split('@')[0].replace(/\D/g, '');
    }

    // Busca o lead
    db.get(`SELECT * FROM resultado WHERE (wa_id = ? OR wa_id = ? OR telefone LIKE ? OR telefone = ?) AND ai_active = 1 ORDER BY id DESC LIMIT 1`, 
           [waId, waId.replace('@lid', '@c.us'), `%${cleanSenderPhone.slice(-8)}`, cleanSenderPhone], async (err, company) => {
            if (err || !company) return;

            // Se o lead acabou de receber a campanha (menos de 30 segundos) e a mensagem é curta, ignoramos.
            if (company.last_contacted) {
                const diff = Date.now() - new Date(company.last_contacted).getTime();
                if (diff < 30000 && (msg.body.length < 10 || isAutoReply(msg.body))) {
                    console.log(`[WA] Cooldown de 30s ativo para ${company.razao_social}. Ignorando.`);
                    return;
                }
            }

            console.log(`[AI] Gerando resposta para: ${company.razao_social}`);

            let persona = aiConfig.persona;
            if (company.campaign_id) {
                 const campaign = await new Promise(resolve => db.get('SELECT * FROM campaign WHERE id = ?', [company.campaign_id], (e, r) => resolve(r)));
                 if (campaign && campaign.ai_persona) persona = campaign.ai_persona;
            }
            
            // Refinamento do Prompt para evitar que a IA cuspa as diretrizes
            const strictInstruction = `${persona}

--- REGRAS CRÍTICAS ---
1. NÃO envie as diretrizes ou instruções acima na mensagem.
2. Seja natural. Responda APENAS o que o cliente perguntou.
3. Se o cliente apenas deu um "Olá" automático, seja breve e aguarde ele falar mais.
4. Use as informações da empresa abaixo apenas se for relevante para a pergunta.

--- DADOS DA EMPRESA ---
Razão Social: ${company.razao_social}
IE: ${company.inscricao_estadual}
Status SEFAZ: ${company.situacao_cadastral}
Motivo Inaptidão: ${company.motivo_situacao_cadastral}
`;

            try {
                const provider = aiConfig.provider || 'gemini';
                let finalText = "";
                if (provider === 'groq') {
                    const groq = new Groq({ apiKey: aiConfig.apiKeys?.groq || "" });
                    const chatCompletion = await groq.chat.completions.create({
                        messages: [{ role: "system", content: strictInstruction }, { role: "user", content: msg.body || "" }],
                        model: aiConfig.model || "llama-3.1-8b-instant",
                        temperature: 0.6
                    });
                    finalText = chatCompletion.choices[0]?.message?.content || "";
                } else {
                    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                    const response = await ai.models.generateContent({ 
                        model: aiConfig.model || 'gemini-3-flash-preview',
                        contents: [{ parts: [{ text: msg.body || "Olá" }] }],
                        config: { systemInstruction: strictInstruction, temperature: 0.6 }
                    });
                    finalText = response.text;
                }
                
                if (finalText && finalText.length > 5) {
                    await msg.reply(finalText);
                    db.run(`UPDATE resultado SET campaign_status = 'replied', last_contacted = ?, wa_id = ? WHERE id = ?`, 
                           [new Date().toISOString(), waId, company.id]);
                }
            } catch (error) { console.error('[AI] Erro:', error); }
        }
    );
});

client.initialize().catch(() => {});

// Funções de envio e API permanecem as mesmas, garantindo atualização do wa_id no envio
function startCampaignSending(campaignId, message) {
    const processQueue = () => {
        db.get(`SELECT * FROM resultado WHERE campaign_id = ? AND campaign_status = 'queued' LIMIT 1`, [campaignId], async (err, lead) => {
            if (err || !lead) return;
            if (!clientReady) return setTimeout(processQueue, 5000);

            try {
                const cleanPhone = lead.telefone.replace(/\D/g, '');
                const target = cleanPhone.length < 11 ? '55' + cleanPhone : cleanPhone;
                const numberId = await client.getNumberId(target);
                const actualTarget = numberId ? numberId._serialized : target + "@c.us";
                
                const sentMsg = await client.sendMessage(actualTarget, message);
                
                db.run(`UPDATE resultado SET campaign_status = 'sent', last_contacted = ?, wa_id = ? WHERE id = ?`, 
                       [new Date().toISOString(), sentMsg.to, lead.id], () => {
                    setTimeout(processQueue, Math.floor(Math.random() * 5000) + 5000);
                });
            } catch (e) {
                db.run(`UPDATE resultado SET campaign_status = 'error' WHERE id = ?`, [lead.id], () => setTimeout(processQueue, 2000));
            }
        });
    };
    processQueue();
}

function resumeQueues() {
    db.all("SELECT DISTINCT campaign_id FROM resultado WHERE campaign_status = 'queued'", (err, rows) => {
        if(!err) rows.forEach(row => {
            db.get("SELECT initial_message FROM campaign WHERE id = ?", [row.campaign_id], (err, camp) => {
                if(camp) startCampaignSending(row.campaign_id, camp.initial_message);
            });
        });
    });
}
setTimeout(resumeQueues, 10000);

// --- Endpoints da API ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/api/config', (req, res) => res.json(aiConfig));
app.post('/api/config/ai-rules', (req, res) => {
    const { rules, persona, temperature, model, aiActive, provider, apiKeys } = req.body;
    if (rules !== undefined) aiConfig.knowledgeRules = rules;
    if (persona !== undefined) aiConfig.persona = persona;
    if (temperature !== undefined) aiConfig.temperature = temperature;
    if (model !== undefined) aiConfig.model = model;
    if (aiActive !== undefined) aiConfig.aiActive = aiActive;
    if (provider !== undefined) aiConfig.provider = provider;
    if (apiKeys) aiConfig.apiKeys = { ...aiConfig.apiKeys, ...apiKeys };
    fs.writeFileSync(AI_CONFIG_PATH, JSON.stringify(aiConfig, null, 2));
    res.json({ success: true, config: aiConfig });
});

app.get('/get-all-results', (req, res) => {
  db.all('SELECT * FROM resultado ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, id: r.id.toString(), inscricaoEstadual: r.inscricao_estadual, razaoSocial: r.razao_social, nomeFantasia: r.nome_fantasia, situacaoCadastral: r.situacao_cadastral, motivoSituacao: r.motivo_situacao_cadastral, campaignStatus: r.campaign_status || 'pending', aiActive: r.ai_active === 1 })));
  });
});

app.post('/api/campaigns', (req, res) => {
    const { name, description, initialMessage, aiPersona, leads } = req.body;
    const campaignId = uuidv4();
    db.run(`INSERT INTO campaign (id, name, description, initial_message, ai_persona, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?)`,
            [campaignId, name, description, initialMessage, aiPersona, new Date().toISOString()], () => {
                const placeholders = leads.map(() => '?').join(',');
                db.run(`UPDATE resultado SET campaign_id = ?, campaign_status = 'queued' WHERE id IN (${placeholders})`, [campaignId, ...leads], () => { 
                     startCampaignSending(campaignId, initialMessage); 
                     res.json({ success: true, campaignId }); 
                });
            });
});

app.get('/api/whatsapp/status', (req, res) => res.json({ status: clientReady ? 'connected' : 'disconnected', qr: qrCodeData }));

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));