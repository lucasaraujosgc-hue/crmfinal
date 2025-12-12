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

// --- GLOBAL STATE FOR SCRAPING CONTROL ---
const activeScrapes = new Map(); // Stores processId -> boolean (true = running, false = abort)

// --- PERSISTENCE SETUP ---
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const AUTH_DIR = path.join(DATA_DIR, 'whatsapp_auth');
const DB_PATH = path.join(DATA_DIR, 'consultas.db');
const AI_CONFIG_PATH = path.join(DATA_DIR, 'ai-config.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({ dest: UPLOADS_DIR });
const db = new sqlite3.Database(DB_PATH);

// Initialize DB
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
    FOREIGN KEY(consulta_id) REFERENCES consulta(id),
    FOREIGN KEY(campaign_id) REFERENCES campaign(id)
  )`);
});

// Load AI Config
let aiConfig = {
  model: 'gemini-2.5-flash',
  persona: 'Você é um assistente útil.',
  knowledgeRules: [], 
  temperature: 0.7,
  aiActive: true
};

if (fs.existsSync(AI_CONFIG_PATH)) {
    try {
        const savedConfig = JSON.parse(fs.readFileSync(AI_CONFIG_PATH, 'utf8'));
        aiConfig = { ...aiConfig, ...savedConfig };
    } catch (e) {
        console.error("Erro ao carregar ai-config.json", e);
    }
} else {
    // Save defaults
    fs.writeFileSync(AI_CONFIG_PATH, JSON.stringify(aiConfig, null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// --- SCRAPING LOGIC ---

// Helper function to decode HTML entities
function decodeHTMLEntities(text) {
    if (!text) return '';
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'",
        '&nbsp;': ' ',
        '&atilde;': 'ã',
        '&ccedil;': 'ç',
        '&iacute;': 'í',
        '&ocirc;': 'ô',
        '&otilde;': 'õ',
        '&uacute;': 'ú'
    };
    return text.replace(/&[a-z]+;/g, match => entities[match] || match);
}

async function runScraping(filepath, processId) {
    console.log(`[Scraper] Iniciando para arquivo: ${filepath}`);
    activeScrapes.set(processId, true); // Mark as active
    
    let browser = null;
    
    try {
        const dataBuffer = fs.readFileSync(filepath);
        const rawPdfData = await pdf(dataBuffer);
        const rawText = rawPdfData.text;
        const cleanText = rawText.replace(/\s+/g, ''); 
        
        const ies = new Set();
        
        // Regex aprimorada para capturar IE seguida de sufixo (Ex: 201.576.135-ME)
        // Isso evita pegar o número seguinte (CPF/CNPJ) que não tem o sufixo.
        const regexStrict = /(\d{2,3}\.?\d{3}\.?\d{3})-[A-Z]{2}/g;
        
        let match;
        while ((match = regexStrict.exec(cleanText)) !== null) {
            // match[1] contém apenas os dígitos da IE
            const ieDigits = match[1].replace(/\D/g, '');
            // IE Bahia tem 8 ou 9 dígitos
            if (ieDigits.length >= 8 && ieDigits.length <= 9) {
                 ies.add(ieDigits);
            }
        }

        const ieList = Array.from(ies);
        console.log(`[Scraper] Encontradas ${ieList.length} IEs únicas`);

        if (ieList.length === 0) {
            db.run('UPDATE consulta SET status = "error", total = 0 WHERE id = ?', [processId]);
            activeScrapes.delete(processId);
            return;
        }

        db.run('UPDATE consulta SET total = ?, processed = 0 WHERE id = ?', [ieList.length, processId]);

        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--disable-extensions',
                '--window-size=1280,800'
            ],
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        for (let i = 0; i < ieList.length; i++) {
            // Check cancellation signal
            if (activeScrapes.get(processId) === false) {
                console.log(`[Scraper] Processo ${processId} cancelado pelo usuário.`);
                break;
            }

            const ie = ieList[i];
            let resultData = {
                consulta_id: processId,
                inscricao_estadual: ie,
                status: 'Erro'
            };

            try {
                let loaded = false;
                for(let attempt=0; attempt<3; attempt++) {
                    try {
                        await page.goto('https://portal.sefaz.ba.gov.br/scripts/cadastro/cadastroBa/consultaBa.asp', { waitUntil: 'networkidle2', timeout: 30000 });
                        loaded = true;
                        break;
                    } catch(e) { console.log(`[Scraper] Retry navigation ${attempt+1}`); }
                }
                
                if(!loaded) throw new Error("Falha ao carregar site SEFAZ");

                const inputSelector = 'input[name="IE"]';
                await page.waitForSelector(inputSelector, { timeout: 15000 });
                
                // Limpa e digita
                await page.evaluate((sel) => { document.querySelector(sel).value = '' }, inputSelector);
                await page.type(inputSelector, ie, { delay: 100 });
                
                const submitSelector = 'input[name="B2"]';
                
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('Nav timeout ignored')),
                    page.click(submitSelector)
                ]);

                // Espera pelo corpo ou algum elemento chave
                await page.waitForSelector('body', { timeout: 15000 });
                const content = await page.content();
                const $ = cheerio.load(content);
                
                const pageText = $('body').text();
                
                if (pageText.includes('Consulta Básica ao Cadastro do ICMS') || pageText.includes('Razão Social') || pageText.includes('Raz&atilde;o Social')) {
                    
                    const fieldMappings = {
                        'cnpj': ['CNPJ:'],
                        'razao_social': ['Razão Social:', 'Raz&atilde;o Social:'],
                        'nome_fantasia': ['Nome Fantasia:'],
                        'unidade_fiscalizacao': ['Unidade de Fiscalização:', 'Unidade de Fiscaliza&ccedil;&atilde;o:'],
                        'logradouro': ['Logradouro:'],
                        'bairro_distrito': ['Bairro/Distrito:'],
                        'municipio': ['Município:', 'Munic&iacute;pio:'],
                        'uf': ['UF:'],
                        'cep': ['CEP:'],
                        'telefone': ['Telefone:'],
                        'email': ['E-mail:'],
                        'atividade_economica_principal': ['Atividade Econômica Principal:', 'Atividade Econ&ocirc;mica Principal:'],
                        'condicao': ['Condição:', 'Condi&ccedil;&atilde;o:'],
                        'forma_pagamento': ['Forma de pagamento:'],
                        'situacao_cadastral': ['Situação Cadastral Vigente:', 'Situa&ccedil;&atilde;o Cadastral Vigente:'],
                        'data_situacao_cadastral': ['Data desta Situação Cadastral:', 'Data desta Situa&ccedil;&atilde;o Cadastral:'],
                        'motivo_situacao_cadastral': ['Motivo desta Situação Cadastral:', 'Motivo desta Situa&ccedil;&atilde;o Cadastral:'],
                        'nome_contador': ['Nome:', 'Nome (Contador):']
                    };

                    const extractField = (keys) => {
                        for (const key of keys) {
                            // Find B or TD tags that contain the key text
                            const element = $(`b, td, font`).filter((i, el) => {
                                // Cheerio decodes entities in .text(), so 'Raz&atilde;o' becomes 'Razão'
                                const text = $(el).text().trim();
                                // Clean up the key for comparison (e.g. remove &nbsp from key if needed, but Cheerio handles entities)
                                // We check if the element STARTS with the label
                                const cleanKey = key.replace(/&[a-z]+;/g, ''); // Simple strip for basic check if needed, but text() is better
                                return text.startsWith(key) || text.startsWith(decodeHTMLEntities(key));
                            }).first();

                            if (element.length > 0) {
                                // CASE 1: Value is in the Next Sibling (Text Node)
                                // Ex: <b>Logradouro:</b> RUA XYZ
                                const nextSibling = element[0].nextSibling;
                                if (nextSibling && nextSibling.nodeType === 3) {
                                    const val = $(nextSibling).text().trim();
                                    if(val) return val;
                                }

                                // CASE 2: Value is in the Next Element (TD)
                                // Ex: <td><b>Logradouro:</b></td><td>RUA XYZ</td>
                                const nextTd = element.closest('td').next('td');
                                if (nextTd.length > 0) {
                                    const val = nextTd.text().trim();
                                    if(val) return val;
                                }

                                // CASE 3: Value is in the Next Row (TR)
                                // Ex: <tr><td><b>Atividade:</b></td></tr><tr><td>1234 - ...</td></tr>
                                const nextTr = element.closest('tr').next('tr');
                                if (nextTr.length > 0) {
                                    const val = nextTr.find('td').first().text().trim();
                                    if(val) return val;
                                }

                                // CASE 4: Value is inside the same element but after label
                                const fullText = element.text().trim();
                                const labelText = decodeHTMLEntities(key);
                                if (fullText.length > labelText.length) {
                                    return fullText.replace(labelText, '').trim();
                                }
                            }
                        }
                        return null;
                    };

                    resultData = {
                        consulta_id: processId,
                        inscricao_estadual: extractField(['Inscrição Estadual:', 'Inscri&ccedil;&atilde;o Estadual:']) || ie,
                        cnpj: extractField(fieldMappings.cnpj),
                        razao_social: extractField(fieldMappings.razao_social),
                        nome_fantasia: extractField(fieldMappings.nome_fantasia),
                        unidade_fiscalizacao: extractField(fieldMappings.unidade_fiscalizacao),
                        logradouro: extractField(fieldMappings.logradouro),
                        bairro_distrito: extractField(fieldMappings.bairro_distrito),
                        municipio: extractField(fieldMappings.municipio),
                        uf: extractField(fieldMappings.uf),
                        cep: extractField(fieldMappings.cep),
                        telefone: extractField(fieldMappings.telefone),
                        email: extractField(fieldMappings.email),
                        atividade_economica_principal: extractField(fieldMappings.atividade_economica_principal),
                        condicao: extractField(fieldMappings.condicao),
                        forma_pagamento: extractField(fieldMappings.forma_pagamento),
                        situacao_cadastral: extractField(fieldMappings.situacao_cadastral),
                        data_situacao_cadastral: extractField(fieldMappings.data_situacao_cadastral),
                        motivo_situacao_cadastral: extractField(fieldMappings.motivo_situacao_cadastral),
                        nome_contador: extractField(fieldMappings.nome_contador),
                        status: 'Sucesso'
                    };
                    
                    // Cleanup extra encoding artifacts
                    Object.keys(resultData).forEach(key => {
                        if (typeof resultData[key] === 'string') {
                            // Replace &nbsp; explicitly then decode others
                            let val = resultData[key].replace(/\u00a0/g, ' '); 
                            resultData[key] = decodeHTMLEntities(val).trim();
                        }
                    });

                } else {
                    const errorMsg = $('font[color="#FF0000"]').text().trim() || 'IE não encontrada/Erro';
                    resultData.status = 'Erro: ' + errorMsg.substring(0, 50);
                }

            } catch (err) {
                console.error(`[Scraper] Exception IE ${ie}:`, err.message);
                resultData.status = 'Erro: ' + err.message;
            }

            // Double check cancellation before insert
            if (activeScrapes.get(processId) === false) break;

            const cols = Object.keys(resultData).join(',');
            const vals = Object.values(resultData);
            const placeholders = vals.map(() => '?').join(',');
            
            db.run(`INSERT INTO resultado (${cols}) VALUES (${placeholders})`, vals);
            db.run('UPDATE consulta SET processed = ? WHERE id = ?', [i + 1, processId]);
            
            const delay = Math.floor(Math.random() * 2000) + 1000;
            await new Promise(r => setTimeout(r, delay));
        }

        if (activeScrapes.get(processId) === false) {
             // If cancelled, just leave it (deletion handled by API)
             console.log(`[Scraper] Finalizando thread cancelada ${processId}`);
        } else {
             db.run('UPDATE consulta SET status = "completed", end_time = ? WHERE id = ?', [new Date().toISOString(), processId]);
        }

    } catch (error) {
        console.error('[Scraper] Erro Fatal:', error);
        db.run('UPDATE consulta SET status = "error" WHERE id = ?', [processId]);
    } finally {
        activeScrapes.delete(processId);
        if (browser) await browser.close();
    }
}

// --- CLEANUP LOCK FILES ON STARTUP ---
function cleanAuthLock() {
    try {
        if (fs.existsSync(AUTH_DIR)) {
             const findAndDeleteLock = (dir) => {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    if (fs.lstatSync(fullPath).isDirectory()) {
                        findAndDeleteLock(fullPath);
                    } else if (file === 'SingletonLock') {
                        console.log(`[Startup] Removing lock file: ${fullPath}`);
                        fs.unlinkSync(fullPath);
                    }
                }
            };
            findAndDeleteLock(AUTH_DIR);
        }
    } catch (e) {
        console.error('[Startup] Error cleaning lock files:', e);
    }
}

cleanAuthLock();

// --- WHATSAPP CLIENT ---
const client = new Client({
  authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote', 
      '--disable-gpu',
      '--disable-extensions'
    ],
  },
  webVersionCache: {
    type: "remote",
    remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
  }
});

let qrCodeData = null;
let clientReady = false;

client.on('qr', (qr) => {
  console.log('QR Code recebido');
  QRCode.toDataURL(qr, (err, url) => qrCodeData = url);
});

client.on('ready', () => {
  console.log('WhatsApp Conectado!');
  clientReady = true;
  qrCodeData = null;
});

// --- IA MESSAGE HANDLING ---
client.on('message', async (msg) => {
    if (msg.fromMe) return; 
    if (!aiConfig.aiActive) return;

    const rawPhone = msg.from.replace(/\D/g, '');
    const phoneSuffix = rawPhone.slice(-8);

    console.log(`[AI] Msg de ${rawPhone}`);

    db.get(`SELECT * FROM resultado WHERE telefone LIKE ? ORDER BY id DESC LIMIT 1`, [`%${phoneSuffix}`], async (err, company) => {
            
            let systemInstruction = aiConfig.persona;
            
            if (company && company.campaign_id) {
                 const campaign = await new Promise(resolve => {
                     db.get('SELECT * FROM campaign WHERE id = ?', [company.campaign_id], (e, r) => resolve(r));
                 });
                 if (campaign && campaign.ai_persona) systemInstruction = campaign.ai_persona;
            }

            let contextData = "";
            let matchedRule = null;

            if (company) {
                // Se respondeu, atualiza status
                if (company.campaign_status === 'sent') {
                     db.run(`UPDATE resultado SET campaign_status = 'replied' WHERE id = ?`, [company.id]);
                }

                contextData += `\n\n--- DADOS DA EMPRESA (CLIENTE) ---\n`;
                contextData += `Razão Social: ${company.razao_social}\nIE: ${company.inscricao_estadual}\nStatus: ${company.situacao_cadastral}\nMotivo: ${company.motivo_situacao_cadastral}\nMunicípio: ${company.municipio}\n`;
                
                // Enhanced matching logic for Knowledge Base
                if (company.motivo_situacao_cadastral && aiConfig.knowledgeRules) {
                    const companyReason = company.motivo_situacao_cadastral.toLowerCase().trim();
                    matchedRule = aiConfig.knowledgeRules.find(rule => {
                        if (!rule.isActive || !rule.motivoSituacao) return false;
                        const ruleReason = rule.motivoSituacao.toLowerCase().trim();
                        return companyReason.includes(ruleReason) || ruleReason.includes(companyReason);
                    });

                    if (matchedRule) {
                        contextData += `\n--- DIAGNÓSTICO E INSTRUÇÕES (Base de Conhecimento) ---\n`;
                        contextData += `O cliente possui o problema: "${matchedRule.motivoSituacao}".\n`;
                        contextData += `Siga estas instruções:\n`;
                        if (matchedRule.instructions) {
                            matchedRule.instructions.forEach(inst => contextData += `- [${inst.title}]: ${inst.content}\n`);
                        }
                    }
                }
            } else {
                contextData += `\nNota: Cliente não identificado no banco. Pergunte o CNPJ/IE se necessário.`;
            }

            // Audio & Image Handling
            let promptParts = [];
            
            if (msg.hasMedia) {
                try {
                    const media = await msg.downloadMedia();
                    if (media) {
                         promptParts.push({
                             inlineData: { mimeType: media.mimetype, data: media.data }
                         });
                         
                         if (media.mimetype.startsWith('audio/')) {
                             promptParts.push({ text: "O usuário enviou um áudio. Ouça atentamente, entenda o contexto e responda de forma natural em texto." });
                         } else if (media.mimetype.startsWith('image/')) {
                             promptParts.push({ text: "Analise a imagem enviada pelo usuário." });
                         }
                    }
                } catch (e) { console.error("Erro mídia", e); }
            }

            if (msg.body) promptParts.push({ text: msg.body });
            
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const model = ai.models.generateContent({ 
                    model: aiConfig.model || 'gemini-2.5-flash',
                    contents: { role: 'user', parts: promptParts },
                    config: {
                        systemInstruction: systemInstruction + contextData,
                        temperature: aiConfig.temperature || 0.7
                    }
                });

                const response = await model;
                await msg.reply(response.text);

            } catch (error) { console.error("Erro IA:", error); }
        }
    );
});

// Inicialização com tratamento de erro
try {
    client.initialize().catch(err => console.error('[WhatsApp] Init Error:', err));
} catch(err) {
    console.error('[WhatsApp] Fatal Init Error:', err);
}

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('[Server] Shutting down...');
    await client.destroy();
    process.exit(0);
});

// --- API ROUTES ---

// Update AI Config (Persist to file)
app.post('/api/config/ai-rules', (req, res) => {
  const { rules, persona, temperature, model, aiActive } = req.body;
  
  if (rules !== undefined) aiConfig.knowledgeRules = rules;
  if (persona !== undefined) aiConfig.persona = persona;
  if (temperature !== undefined) aiConfig.temperature = temperature;
  if (model !== undefined) aiConfig.model = model;
  if (aiActive !== undefined) aiConfig.aiActive = aiActive;

  try {
      fs.writeFileSync(AI_CONFIG_PATH, JSON.stringify(aiConfig, null, 2));
      res.json({ success: true });
  } catch (e) {
      console.error("Erro ao salvar config", e);
      res.status(500).json({ error: "Falha ao salvar configuração" });
  }
});

// Get AI Config
app.get('/api/config', (req, res) => {
    res.json(aiConfig);
});

app.get('/api/unique-filters', (req, res) => {
    db.all('SELECT DISTINCT municipio FROM resultado WHERE municipio IS NOT NULL AND municipio != ""', (err, rows) => {
        const municipios = rows.map(r => r.municipio).filter(Boolean).sort();
        db.all('SELECT DISTINCT motivo_situacao_cadastral FROM resultado WHERE motivo_situacao_cadastral IS NOT NULL AND motivo_situacao_cadastral != ""', (err, rows2) => {
             const motivos = rows2.map(r => r.motivo_situacao_cadastral).filter(Boolean).sort();
             res.json({ municipios, motivos });
        });
    });
});

app.get('/get-imports', (req, res) => {
    db.all('SELECT * FROM consulta ORDER BY start_time DESC', (err, rows) => res.json(rows));
});

app.get('/get-all-results', (req, res) => {
  db.all('SELECT * FROM resultado ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const formatted = rows.map(r => ({
        id: r.id.toString(),
        consultaId: r.consulta_id,
        campaignId: r.campaign_id,
        inscricaoEstadual: r.inscricao_estadual,
        cnpj: r.cnpj,
        razaoSocial: r.razao_social,
        municipio: r.municipio,
        telefone: r.telefone,
        situacaoCadastral: r.situacao_cadastral,
        motivoSituacao: r.motivo_situacao_cadastral,
        nomeContador: r.nome_contador,
        status: r.status,
        campaignStatus: r.campaign_status || 'pending'
    }));
    res.json(formatted);
  });
});

app.post('/start-processing', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const processId = uuidv4();
    const filepath = req.file.path;
    const stmt = db.prepare('INSERT INTO consulta (id, filename, total, processed, status, start_time) VALUES (?, ?, ?, ?, ?, ?)');
    stmt.run(processId, req.file.originalname, 0, 0, 'processing', new Date().toISOString());
    stmt.finalize();
    res.json({ processId });
    runScraping(filepath, processId);
});

app.get('/progress/:id', (req, res) => {
    const processId = req.params.id;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const interval = setInterval(() => {
        db.get('SELECT * FROM consulta WHERE id = ?', [processId], (err, row) => {
            if (err || !row) {
                res.write(`data: ${JSON.stringify({ status: 'not_found' })}\n\n`);
                clearInterval(interval);
                return;
            }
            res.write(`data: ${JSON.stringify(row)}\n\n`);
            if (row.status === 'completed' || row.status === 'error') clearInterval(interval);
        });
    }, 1000);
    req.on('close', () => clearInterval(interval));
});

// Cleanup Orphaned Results
app.post('/api/cleanup', (req, res) => {
    db.run(`DELETE FROM resultado WHERE consulta_id NOT IN (SELECT id FROM consulta)`, (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({success: true, message: "Dados órfãos removidos"});
    });
});

app.delete('/api/imports/:id', (req, res) => {
    const id = req.params.id;
    
    // Stop scraping if running
    if (activeScrapes.has(id)) {
        console.log(`[API] Solicitando parada do scraping ${id}`);
        activeScrapes.set(id, false); // Signal stop
    }

    // Give it a moment to stop loop before deleting rows
    setTimeout(() => {
        db.run('DELETE FROM resultado WHERE consulta_id = ?', [id], (err) => {
            db.run('DELETE FROM consulta WHERE id = ?', [id], (err) => res.json({ success: true }));
        });
    }, 500);
});

app.post('/api/imports/retry/:id', (req, res) => {
    res.json({ success: false, error: 'Re-upload required for retry in this version' });
});

app.get('/api/campaigns', (req, res) => {
    db.all('SELECT * FROM campaign ORDER BY created_at DESC', (err, campaigns) => {
        if (err) return res.status(500).json({ error: err.message });
        const promises = campaigns.map(c => new Promise(resolve => {
             db.get(`SELECT COUNT(*) as total, 
                SUM(CASE WHEN campaign_status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN campaign_status = 'replied' THEN 1 ELSE 0 END) as replied
                FROM resultado WHERE campaign_id = ?`, [c.id], (e, stats) => resolve({ ...c, stats }));
        }));
        Promise.all(promises).then(data => res.json(data));
    });
});

// Delete Campaign Endpoint
app.delete('/api/campaigns/:id', (req, res) => {
    const id = req.params.id;
    // Set leads back to pending/no-campaign
    db.run('UPDATE resultado SET campaign_id = NULL, campaign_status = "pending" WHERE campaign_id = ?', [id], (err) => {
        if(err) return res.status(500).json({error: "Failed to unlink leads"});
        // Delete campaign
        db.run('DELETE FROM campaign WHERE id = ?', [id], (err) => {
            if(err) return res.status(500).json({error: "Failed to delete campaign"});
            res.json({success: true});
        });
    });
});

app.post('/api/campaigns', (req, res) => {
    const { name, description, initialMessage, aiPersona, leads } = req.body;
    const campaignId = uuidv4();
    db.run(`INSERT INTO campaign (id, name, description, initial_message, ai_persona, status, created_at) VALUES (?, ?, ?, ?, ?, 'active', ?)`,
            [campaignId, name, description, initialMessage, aiPersona, new Date().toISOString()],
            (err) => {
                if (leads && leads.length > 0) {
                     const placeholders = leads.map(() => '?').join(',');
                     db.run(`UPDATE resultado SET campaign_id = ?, campaign_status = 'queued' WHERE id IN (${placeholders})`,
                     [campaignId, ...leads], () => {
                          startCampaignSending(campaignId, initialMessage);
                          res.json({ success: true, campaignId });
                     });
                } else { res.json({ success: true, campaignId }); }
            });
});

function startCampaignSending(campaignId, message) {
    console.log(`Starting campaign ${campaignId}`);
    const processQueue = () => {
        db.get(`SELECT * FROM resultado WHERE campaign_id = ? AND campaign_status = 'queued' LIMIT 1`, [campaignId], async (err, lead) => {
            if (!lead) return;
            
            let sent = false;
            // Validate Phone Number
            if (lead.telefone && clientReady) {
                 try {
                     const formattedPhone = lead.telefone.replace(/\D/g, '');
                     // Basic validation: must be at least 10 digits
                     if (formattedPhone.length >= 10) {
                         const target = formattedPhone.length < 12 ? '55' + formattedPhone : formattedPhone;
                         const chatId = target + "@c.us";
                         await client.sendMessage(chatId, message);
                         sent = true;
                     }
                 } catch (e) {
                     console.error(`Failed to send to ${lead.razao_social}`, e.message);
                 }
            } 
            
            const newStatus = sent ? 'sent' : (lead.telefone ? 'error' : 'skipped');
            db.run(`UPDATE resultado SET campaign_status = ?, last_contacted = ? WHERE id = ?`, [newStatus, new Date().toISOString(), lead.id]);
            
            const delay = Math.floor(Math.random() * 10000) + 5000;
            setTimeout(processQueue, delay);
        });
    };
    processQueue();
}

app.get('/api/whatsapp/status', (req, res) => res.json({ status: clientReady ? 'connected' : 'disconnected', qr: qrCodeData }));
app.get('/api/whatsapp/chats', async (req, res) => {
  if (!clientReady) return res.json([]);
  try {
    const chats = await client.getChats();
    res.json(chats.map(c => ({ id: c.id._serialized, name: c.name, timestamp: c.timestamp, lastMessage: c.lastMessage?.body || '', unreadCount: c.unreadCount })));
  } catch (e) { res.json([]); }
});
app.get('/api/whatsapp/messages/:chatId', async (req, res) => {
  if (!clientReady) return res.json([]);
  try {
    const chat = await client.getChatById(req.params.chatId);
    const messages = await chat.fetchMessages({ limit: 50 });
    res.json(messages.map(m => ({ id: m.id.id, fromMe: m.fromMe, body: m.body, timestamp: m.timestamp, hasMedia: m.hasMedia, type: m.type })));
  } catch (e) { res.json([]); }
});
app.post('/api/whatsapp/send', async (req, res) => {
  if (!clientReady) return res.status(400).json({ error: 'Client not ready' });
  try { await client.sendMessage(req.body.chatId, req.body.message); res.json({ success: true }); } 
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Update Status (Kanban)
app.post('/api/leads/status', (req, res) => {
    const { id, status } = req.body;
    db.run('UPDATE resultado SET campaign_status = ? WHERE id = ?', [status, id], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({success: true});
    });
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));