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
  )`, (err) => {
      if (!err) {
          db.run("ALTER TABLE resultado ADD COLUMN wa_id TEXT", (e) => {});
          db.run("ALTER TABLE resultado ADD COLUMN ai_active INTEGER DEFAULT 1", (e) => {});
      }
      setTimeout(resumeQueues, 5000);
  });
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

function decodeHTMLEntities(text) {
    if (!text) return '';
    const entities = {
        '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
        '&nbsp;': ' ', '&atilde;': 'ã', '&ccedil;': 'ç', '&iacute;': 'í',
        '&ocirc;': 'ô', '&otilde;': 'õ', '&uacute;': 'ú'
    };
    return text.replace(/&[a-z]+;/g, match => entities[match] || match);
}

const KNOWN_LABELS = [
    'Natureza Jurídica:', 'Natureza Jur&iacute;dica:',
    'Nome Fantasia:', 'Razão Social:', 'Raz&atilde;o Social:',
    'Logradouro:', 'Bairro/Distrito:',
    'Município:', 'Munic&iacute;pio:', 'UF:', 'CEP:',
    'Telefone:', 'E-mail:',
    'Atividade Econômica Principal:', 'Atividade Econ&ocirc;mica Principal:',
    'Atividade Econômica Secundária:', 'Atividade Econ&ocirc;mica Secund&aacute;ria:',
    'Condição:', 'Condi&ccedil;&atilde;o:',
    'Forma de pagamento:',
    'Situação Cadastral Vigente:', 'Situa&ccedil;&atilde;o Cadastral Vigente:',
    'Data desta Situação Cadastral:', 'Data desta Situa&ccedil;&atilde;o Cadastral:',
    'Motivo desta Situação Cadastral:', 'Motivo desta Situa&ccedil;&atilde;o Cadastral:',
    'Inscrição Estadual:', 'Inscri&ccedil;&atilde;o Estadual:',
    'CNPJ:', 'Nome (Contador):', 'Nome:'
];

function cleanValue(val, currentLabel = '') {
    if (!val) return '';
    let cleaned = val.replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').trim();
    if (currentLabel) {
        const plainLabel = currentLabel.replace(/<[^>]*>/g, '').replace(':', '').trim();
        const regexSelf = new RegExp(`^${plainLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:?\\s*`, 'i');
        cleaned = cleaned.replace(regexSelf, '');
    }
    for (const label of KNOWN_LABELS) {
        const plainLabel = label.replace(/<[^>]*>/g, '').replace(':', '').trim();
        const decodedLabel = decodeHTMLEntities(plainLabel);
        const checks = [plainLabel, decodedLabel];
        for (const check of checks) {
             if (!check || check.length < 3) continue;
             const regexCut = new RegExp(`${check.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:`, 'i');
             const match = cleaned.match(regexCut);
             if (match && match.index !== undefined && match.index > 0) {
                 cleaned = cleaned.substring(0, match.index);
             }
        }
    }
    return cleaned.trim();
}

async function runScraping(filepath, processId) {
    activeScrapes.set(processId, true); 
    let browser = null;
    try {
        const dataBuffer = fs.readFileSync(filepath);
        const rawPdfData = await pdf(dataBuffer);
        const rawText = rawPdfData.text;
        const cleanText = rawText.replace(/\s+/g, ''); 
        const ies = new Set();
        const regexStrict = /(\d{2,3}\.?\d{3}\.?\d{3})-[A-Z]{2}/g;
        let match;
        while ((match = regexStrict.exec(cleanText)) !== null) {
            const ieDigits = match[1].replace(/\D/g, '');
            if (ieDigits.length >= 8 && ieDigits.length <= 9) ies.add(ieDigits);
        }
        const ieList = Array.from(ies);
        if (ieList.length === 0) {
            db.run('UPDATE consulta SET status = "error", total = 0 WHERE id = ?', [processId]);
            activeScrapes.delete(processId);
            return;
        }
        db.run('UPDATE consulta SET total = ?, processed = 0 WHERE id = ?', [ieList.length, processId]);
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            ignoreHTTPSErrors: true
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        for (let i = 0; i < ieList.length; i++) {
            if (activeScrapes.get(processId) === false) break;
            const ie = ieList[i];
            let resultData = { consulta_id: processId, inscricao_estadual: ie, status: 'Erro' };
            try {
                await page.goto('https://portal.sefaz.ba.gov.br/scripts/cadastro/cadastroBa/consultaBa.asp', { waitUntil: 'networkidle2', timeout: 30000 });
                const inputSelector = 'input[name="IE"]';
                await page.waitForSelector(inputSelector, { timeout: 15000 });
                await page.type(inputSelector, ie, { delay: 100 });
                const submitSelector = 'input[name="B2"]';
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
                    page.click(submitSelector)
                ]);
                await page.waitForSelector('body', { timeout: 15000 });
                const content = await page.content();
                const $ = cheerio.load(content);
                const bodyText = $('body').text().replace(/\s+/g, ' ');

                if (bodyText.includes('Razão Social')) {
                    const extractByLabel = (labels) => {
                        for (const label of labels) {
                            const element = $(`td, b, font`).filter((i, el) => $(el).text().trim().includes(label)).first();
                            if (element.length > 0) {
                                let rawText = element.parent().text().split(label)[1];
                                if (!rawText) {
                                    const nextTd = element.closest('td').next('td');
                                    if (nextTd.length) rawText = nextTd.text();
                                }
                                if (rawText) return cleanValue(rawText, label);
                            }
                        }
                        return '';
                    };
                    resultData.razao_social = extractByLabel(['Razão Social:', 'Raz&atilde;o Social:']);
                    resultData.nome_fantasia = extractByLabel(['Nome Fantasia:']);
                    resultData.cnpj = extractByLabel(['CNPJ:']);
                    resultData.municipio = extractByLabel(['Município:', 'Munic&iacute;pio:']).split('UF')[0].trim();
                    resultData.uf = extractByLabel(['UF:']);
                    resultData.logradouro = extractByLabel(['Logradouro:']);
                    resultData.bairro_distrito = extractByLabel(['Bairro/Distrito:']);
                    resultData.cep = extractByLabel(['CEP:']);
                    
                    const rawTel = extractByLabel(['Telefone:']);
                    resultData.telefone = rawTel ? rawTel.replace(/\D/g, '') : '';
                    
                    resultData.situacao_cadastral = extractByLabel(['Situação Cadastral Vigente:', 'Situa&ccedil;&atilde;o Cadastral Vigente:']).split('Data')[0].trim();
                    resultData.data_situacao_cadastral = extractByLabel(['Data desta Situação Cadastral:', 'Data desta Situa&ccedil;&atilde;o Cadastral:']);
                    let motivo = extractByLabel(['Motivo desta Situação Cadastral:', 'Motivo desta Situa&ccedil;&atilde;o Cadastral:']);
                    if (motivo) {
                         const cutOffs = ['Endereço de Correspondência', 'Endereço:', 'Endereco de Correspondencia'];
                         for (const cut of cutOffs) {
                             const idx = motivo.toLowerCase().indexOf(cut.toLowerCase());
                             if (idx !== -1) motivo = motivo.substring(0, idx);
                         }
                    }
                    resultData.motivo_situacao_cadastral = motivo.trim();
                    resultData.nome_contador = extractByLabel(['Nome (Contador):', 'Nome:']);
                    resultData.status = 'Sucesso';
                } else {
                    resultData.status = 'Erro: IE não localizada';
                }
            } catch (err) {
                resultData.status = 'Erro: ' + err.message;
            }
            const cols = Object.keys(resultData).join(',');
            const vals = Object.values(resultData);
            const placeholders = vals.map(() => '?').join(',');
            db.run(`INSERT INTO resultado (${cols}) VALUES (${placeholders})`, vals);
            db.run('UPDATE consulta SET processed = ? WHERE id = ?', [i + 1, processId]);
            await new Promise(r => setTimeout(r, 1000));
        }
        db.run('UPDATE consulta SET status = "completed", end_time = ? WHERE id = ?', [new Date().toISOString(), processId]);
    } catch (error) {
        db.run('UPDATE consulta SET status = "error" WHERE id = ?', [processId]);
    } finally {
        activeScrapes.delete(processId);
        if (browser) await browser.close();
    }
}

function cleanAuthLock() {
    try {
        if (fs.existsSync(AUTH_DIR)) {
             const findAndDeleteLock = (dir) => {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    if (fs.lstatSync(fullPath).isDirectory()) findAndDeleteLock(fullPath);
                    else if (file === 'SingletonLock') fs.unlinkSync(fullPath);
                }
            };
            findAndDeleteLock(AUTH_DIR);
        }
    } catch (e) {}
}
cleanAuthLock();

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
client.on('ready', () => { console.log('WhatsApp Conectado!'); clientReady = true; qrCodeData = null; });

client.on('message', async (msg) => {
    if (msg.fromMe || msg.from.includes('status@broadcast') || msg.from.includes('@g.us')) return;
    if (!aiConfig.aiActive) return;

    let waId = msg.from; // ID original (pode ser @lid ou @c.us)
    let cleanSenderPhone = "";
    
    try {
        const contact = await msg.getContact();
        // contact.number geralmente tem o telefone real se o servidor resolveu o LID
        if (contact.number) {
            cleanSenderPhone = contact.number.replace(/\D/g, '');
        } else {
            cleanSenderPhone = (contact.id.user || msg.from.split('@')[0]).replace(/\D/g, '');
        }
    } catch(e) {
        cleanSenderPhone = msg.from.split('@')[0].replace(/\D/g, '');
    }
    
    if (!cleanSenderPhone && !waId) return;

    // Busca o lead priorizando o ID exato (wa_id) salvo no momento do envio
    db.get(`SELECT * FROM resultado WHERE (wa_id = ? OR wa_id = ? OR telefone LIKE ? OR telefone = ?) AND ai_active = 1 ORDER BY id DESC LIMIT 1`, 
           [waId, waId.replace('@lid', '@c.us'), `%${cleanSenderPhone.slice(-8)}`, cleanSenderPhone], async (err, company) => {
            if (err) {
                console.error('[DB] Erro:', err);
                return;
            }
            if (!company) {
                console.log(`[WA] Lead não localizado para ${waId} (Resolvido: ${cleanSenderPhone})`);
                return;
            }

            // Garante o vínculo do wa_id para futuras mensagens
            if (!company.wa_id || company.wa_id !== waId) {
                db.run(`UPDATE resultado SET wa_id = ? WHERE id = ?`, [waId, company.id]);
            }

            console.log(`[AI] Gerando resposta para: ${company.razao_social}`);

            let systemInstruction = aiConfig.persona;
            if (company.campaign_id) {
                 const campaign = await new Promise(resolve => db.get('SELECT * FROM campaign WHERE id = ?', [company.campaign_id], (e, r) => resolve(r)));
                 if (campaign && campaign.ai_persona) systemInstruction = campaign.ai_persona;
            }
            
            let contextData = `\n\n--- DADOS DA EMPRESA ---\nRazão Social: ${company.razao_social}\nIE: ${company.inscricao_estadual}\nStatus: ${company.situacao_cadastral}\nMotivo: ${company.motivo_situacao_cadastral}\n`;
            
            if (company.motivo_situacao_cadastral && aiConfig.knowledgeRules) {
                const matchedRule = aiConfig.knowledgeRules.find(rule => rule.isActive && company.motivo_situacao_cadastral.toLowerCase().includes(rule.motivoSituacao.toLowerCase()));
                if (matchedRule) {
                    contextData += `\n--- DIAGNÓSTICO E REGRAS ---\n`;
                    matchedRule.instructions.forEach(inst => contextData += `- ${inst.content}\n`);
                }
            }

            try {
                const provider = aiConfig.provider || 'gemini';
                let finalText = "";
                if (provider === 'groq') {
                    const groq = new Groq({ apiKey: aiConfig.apiKeys?.groq || "" });
                    const chatCompletion = await groq.chat.completions.create({
                        messages: [{ role: "system", content: systemInstruction + contextData }, { role: "user", content: msg.body || "" }],
                        model: aiConfig.model || "llama-3.1-8b-instant",
                        temperature: aiConfig.temperature || 0.7
                    });
                    finalText = chatCompletion.choices[0]?.message?.content || "";
                } else {
                    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                    const response = await ai.models.generateContent({ 
                        model: aiConfig.model || 'gemini-3-flash-preview',
                        contents: [{ parts: [{ text: msg.body || "Olá" }] }],
                        config: { 
                          systemInstruction: systemInstruction + contextData, 
                          temperature: aiConfig.temperature || 0.7 
                        }
                    });
                    finalText = response.text;
                }
                if (finalText) {
                    await msg.reply(finalText);
                    db.run(`UPDATE resultado SET campaign_status = 'replied' WHERE id = ?`, [company.id]);
                }
            } catch (error) { 
                console.error('[AI] Erro:', error); 
            }
        }
    );
});

try { client.initialize().catch(() => {}); } catch(err) {}

function resumeQueues() {
    db.all("SELECT DISTINCT campaign_id FROM resultado WHERE campaign_status = 'queued'", (err, rows) => {
        if(err) return;
        rows.forEach(row => {
            db.get("SELECT initial_message FROM campaign WHERE id = ?", [row.campaign_id], (err, camp) => {
                if(camp) startCampaignSending(row.campaign_id, camp.initial_message);
            });
        });
    });
}

function startCampaignSending(campaignId, message) {
    const processQueue = () => {
        db.get(`SELECT * FROM resultado WHERE campaign_id = ? AND campaign_status = 'queued' LIMIT 1`, [campaignId], async (err, lead) => {
            if (err || !lead) return;
            if (!clientReady) return setTimeout(processQueue, 5000);

            let status = 'error';
            let finalWaId = null;

            if (lead.telefone) {
                 try {
                     const cleanPhone = lead.telefone.replace(/\D/g, '');
                     const target = cleanPhone.length < 11 ? '55' + cleanPhone : cleanPhone;
                     
                     // RESOLUÇÃO DE IDENTIDADE: Pergunta ao WhatsApp o ID correto do número
                     // Isso retorna o @lid se o contato não estiver salvo.
                     const numberId = await client.getNumberId(target);
                     const actualTarget = numberId ? numberId._serialized : target + "@c.us";
                     
                     const sentMsg = await client.sendMessage(actualTarget, message);
                     finalWaId = sentMsg.to; 
                     status = 'sent';
                     console.log(`[Campaign] Enviado para ${lead.razao_social} | ID: ${finalWaId}`);
                 } catch (e) { 
                     console.error(`[Campaign] Erro para ${lead.razao_social}:`, e.message);
                     status = 'error'; 
                 }
            } else {
                status = 'skipped';
            }

            db.run(`UPDATE resultado SET campaign_status = ?, last_contacted = ?, wa_id = ? WHERE id = ?`, 
                   [status, new Date().toISOString(), finalWaId, lead.id], () => {
                setTimeout(processQueue, Math.floor(Math.random() * 5000) + 5000);
            });
        });
    };
    processQueue();
}

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

app.get('/api/config', (req, res) => res.json(aiConfig));
app.get('/api/unique-filters', (req, res) => {
    db.all('SELECT DISTINCT municipio FROM resultado', (err, rows) => {
        const municipios = rows.map(r => r.municipio).filter(Boolean).sort();
        db.all('SELECT DISTINCT motivo_situacao_cadastral FROM resultado', (err, rows2) => {
             const motivos = rows2.map(r => r.motivo_situacao_cadastral).filter(Boolean).sort();
             res.json({ municipios, motivos });
        });
    });
});
app.get('/get-imports', (req, res) => db.all('SELECT * FROM consulta ORDER BY start_time DESC', (err, rows) => res.json(rows)));
app.get('/get-all-results', (req, res) => {
  db.all('SELECT * FROM resultado ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, id: r.id.toString(), inscricaoEstadual: r.inscricao_estadual, razaoSocial: r.razao_social, nomeFantasia: r.nome_fantasia, situacaoCadastral: r.situacao_cadastral, motivoSituacao: r.motivo_situacao_cadastral, campaignStatus: r.campaign_status || 'pending', aiActive: r.ai_active === 1 })));
  });
});

app.get('/api/campaigns/:id/leads', (req, res) => {
  db.all('SELECT * FROM resultado WHERE campaign_id = ? ORDER BY id DESC', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, id: r.id.toString(), inscricaoEstadual: r.inscricao_estadual, razaoSocial: r.razao_social, nomeFantasia: r.nome_fantasia, situacaoCadastral: r.situacao_cadastral, motivoSituacao: r.motivo_situacao_cadastral, campaignStatus: r.campaign_status || 'pending', aiActive: r.ai_active === 1 })));
  });
});

app.post('/start-processing', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const processId = uuidv4();
    db.run('INSERT INTO consulta (id, filename, total, processed, status, start_time) VALUES (?, ?, ?, ?, ?, ?)', [processId, req.file.originalname, 0, 0, 'processing', new Date().toISOString()]);
    res.json({ processId });
    runScraping(req.file.path, processId);
});

app.get('/progress/:id', (req, res) => {
    const processId = req.params.id;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const interval = setInterval(() => {
        db.get('SELECT * FROM consulta WHERE id = ?', [processId], (err, row) => {
            if (err || !row) { res.write(`data: ${JSON.stringify({ status: 'not_found' })}\n\n`); clearInterval(interval); return; }
            res.write(`data: ${JSON.stringify(row)}\n\n`);
            if (row.status === 'completed' || row.status === 'error') clearInterval(interval);
        });
    }, 1000);
    req.on('close', () => clearInterval(interval));
});

app.post('/api/cleanup', (req, res) => db.run(`DELETE FROM resultado WHERE consulta_id NOT IN (SELECT id FROM consulta)`, () => res.json({success: true})));
app.delete('/api/imports/:id', (req, res) => {
    db.run('DELETE FROM resultado WHERE consulta_id = ?', [req.params.id], () => {
        db.run('DELETE FROM consulta WHERE id = ?', [req.params.id], () => res.json({ success: true }));
    });
});

app.get('/api/campaigns', (req, res) => {
    db.all('SELECT * FROM campaign ORDER BY created_at DESC', (err, campaigns) => {
        const promises = campaigns.map(c => new Promise(resolve => {
             db.get(`SELECT COUNT(*) as total, SUM(CASE WHEN campaign_status = 'sent' THEN 1 ELSE 0 END) as sent, SUM(CASE WHEN campaign_status = 'replied' THEN 1 ELSE 0 END) as replied FROM resultado WHERE campaign_id = ?`, [c.id], (e, stats) => resolve({ ...c, stats }));
        }));
        Promise.all(promises).then(data => res.json(data));
    });
});

app.delete('/api/campaigns/:id', (req, res) => {
    db.run('UPDATE resultado SET campaign_id = NULL, campaign_status = "pending" WHERE campaign_id = ?', [req.params.id], () => {
        db.run('DELETE FROM campaign WHERE id = ?', [req.params.id], () => res.json({success: true}));
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
app.get('/api/whatsapp/chats', async (req, res) => {
  if (!clientReady) return res.json([]);
  try { const chats = await client.getChats(); res.json(chats.map(c => ({ id: c.id._serialized, name: c.name, timestamp: c.timestamp, lastMessage: c.lastMessage?.body || '', unreadCount: c.unreadCount }))); } catch (e) { res.json([]); }
});
app.get('/api/whatsapp/messages/:chatId', async (req, res) => {
  if (!clientReady) return res.json([]);
  try { const chat = await client.getChatById(req.params.chatId); const messages = await chat.fetchMessages({ limit: 50 }); res.json(messages.map(m => ({ id: m.id.id, fromMe: m.fromMe, body: m.body, timestamp: m.timestamp, hasMedia: m.hasMedia, type: m.type }))); } catch (e) { res.json([]); }
});
app.post('/api/whatsapp/send', async (req, res) => {
  if (!clientReady) return res.status(400).json({ error: 'Client not ready' });
  try { await client.sendMessage(req.body.chatId, req.body.message); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/leads/status', (req, res) => { db.run('UPDATE resultado SET campaign_status = ? WHERE id = ?', [req.body.status, req.body.id], () => res.json({success: true})); });
app.post('/api/leads/toggle-ai', (req, res) => { db.run('UPDATE resultado SET ai_active = ? WHERE id = ?', [req.body.active ? 1 : 0, req.body.id], () => res.json({success: true})); });

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));