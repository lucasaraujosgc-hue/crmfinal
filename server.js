import './polyfill.js'; // IMPORTANTE: Deve ser a primeira importação
import express from 'express';
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

// --- Configuração do App ---
const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_FOLDER = path.join(__dirname, 'sefaz_uploads');

if (!fs.existsSync(UPLOAD_FOLDER)) fs.mkdirSync(UPLOAD_FOLDER);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- Banco de Dados SQLite ---
const dbPath = path.join(__dirname, 'consultas.db');
const db = new sqlite3.Database(dbPath);

// Inicialização das Tabelas
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS consulta (
        id TEXT PRIMARY KEY,
        filename TEXT,
        total INTEGER DEFAULT 0,
        processed INTEGER DEFAULT 0,
        status TEXT,
        start_time DATETIME,
        end_time DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS resultado (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        consulta_id TEXT,
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
        last_contacted DATETIME,
        notes TEXT,
        FOREIGN KEY(consulta_id) REFERENCES consulta(id)
    )`);
});

// Helper Functions DB
const runQuery = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
    });
});

const getQuery = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
    });
});

const getOne = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
    });
});

// --- Upload Config ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_FOLDER),
    filename: (req, file, cb) => cb(null, `${uuidv4()}.pdf`)
});
const upload = multer({ storage });

// --- IA Logic & Config ---
const API_KEY = process.env.API_KEY || process.env.GOOGLE_API_KEY;
let activeRules = []; 
const disabledAI = new Set();

app.post('/api/config/ai-rules', (req, res) => {
    const { rules } = req.body;
    activeRules = rules || [];
    res.json({ success: true });
});

// --- WhatsApp Logic ---
let qrCodeData = null;
let whatsappStatus = 'disconnected';

if (!fs.existsSync('./whatsapp_auth')) fs.mkdirSync('./whatsapp_auth');

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './whatsapp_auth' }),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
});

client.on('qr', async (qr) => {
    qrCodeData = await QRCode.toDataURL(qr);
    whatsappStatus = 'qr_ready';
});

client.on('ready', () => {
    console.log('[WhatsApp] Conectado!');
    whatsappStatus = 'connected';
    qrCodeData = null;
});

client.on('disconnected', () => {
    whatsappStatus = 'disconnected';
    setTimeout(initializeWhatsApp, 5000);
});

client.on('message', async msg => {
    if (!API_KEY || msg.fromMe) return;
    const chat = await msg.getChat();
    if (chat.isGroup || disabledAI.has(chat.id._serialized)) return;

    await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
    await chat.sendStateTyping();

    try {
        let contextData = null;
        try {
            const contact = await msg.getContact();
            const cleanPhone = contact.number.replace(/\D/g, '').slice(-8);
            const row = await getOne("SELECT * FROM resultado WHERE telefone LIKE ?", [`%${cleanPhone}`]);
            if (row) {
                contextData = {
                    razaoSocial: row.razao_social,
                    municipio: row.municipio,
                    situacao: row.situacao_cadastral,
                    motivoSituacao: row.motivo_situacao_cadastral
                };
            }
        } catch (err) { console.error('[AI] Contact lookup error:', err); }

        let systemInstruction = `Você é um assistente comercial da CRM VIRGULA.`;
        if (contextData) {
            systemInstruction += `\n\nContexto: Cliente ${contextData.razaoSocial}, Situação: ${contextData.situacao}, Motivo: ${contextData.motivoSituacao}`;
            const matchingRule = activeRules.find(r => contextData.motivoSituacao && r.motivoSituacao && contextData.motivoSituacao.includes(r.motivoSituacao));
            if (matchingRule) {
                matchingRule.instructions.forEach(inst => systemInstruction += `\n[${inst.title}]: ${inst.content}`);
            }
        }

        const parts = [{ text: systemInstruction }];
        let hasAudio = false;

        if (msg.hasMedia) {
            try {
                const media = await msg.downloadMedia();
                if (media) {
                    if (media.mimetype.startsWith('audio/') || media.mimetype.includes('ogg')) {
                         parts.push({ inlineData: { mimeType: media.mimetype.replace('; codecs=opus', ''), data: media.data } });
                         parts.push({ text: "O usuário enviou um áudio. Responda em texto." });
                         hasAudio = true;
                    }
                }
            } catch (e) { console.error("Erro mídia:", e); }
        }

        if (!hasAudio && msg.body) parts.push({ text: msg.body });
        
        if (parts.length === 1 && !hasAudio) return;

        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts } });
        
        if (response.text) {
            await chat.clearState();
            await chat.sendMessage(response.text);
        }
    } catch (e) { 
        console.error('[AI] Erro:', e);
        await chat.clearState();
    }
});

async function initializeWhatsApp() {
    try { await client.initialize(); } catch (e) { setTimeout(initializeWhatsApp, 10000); }
}
initializeWhatsApp();

// --- Lógica de Scraping ---

async function runScraping(processId, filepath, isReprocess = false) {
    let ies = [];
    
    if (isReprocess) {
        const rows = await getQuery("SELECT inscricao_estadual FROM resultado WHERE consulta_id = ?", [processId]);
        ies = rows.map(r => r.inscricao_estadual);
        console.log(`[Scraper] Reprocessando ${ies.length} IEs`);
    } else {
        try {
            console.log(`[Scraper] Lendo PDF: ${filepath}`);
            const dataBuffer = fs.readFileSync(filepath);
            const data = await pdf(dataBuffer);
            console.log(`[Scraper] Texto extraído (${data.text.length} chars)`);
            
            // Regex mais flexível para capturar 8 ou 9 dígitos soltos ou formatados
            const regex = /(\d{2,3}\.?\d{3}\.?\d{3}-?\d{2}|\b\d{8,9}\b)/g;
            const matches = data.text.match(regex);
            
            if (matches) {
                ies = [...new Set(matches.map(m => m.replace(/\D/g, '')))].filter(ie => ie.length >= 8);
            }
            console.log(`[Scraper] Encontradas ${ies.length} IEs únicas no PDF`);
        } catch (e) {
            console.error("[Scraper] Erro ao ler PDF:", e);
            await runQuery("UPDATE consulta SET status = 'error' WHERE id = ?", [processId]);
            return;
        }
    }

    if (ies.length === 0) {
        console.warn("[Scraper] Nenhuma IE encontrada.");
        await runQuery("UPDATE consulta SET status = 'completed', end_time = ? WHERE id = ?", [new Date().toISOString(), processId]);
        return;
    }

    await runQuery("UPDATE consulta SET total = ?, processed = 0, status = 'processing' WHERE id = ?", [ies.length, processId]);

    let browser = null;
    try {
        console.log("[Scraper] Iniciando Browser...");
        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
            args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-setuid-sandbox'],
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        // User Agent para evitar bloqueios simples
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        for (let i = 0; i < ies.length; i++) {
            const ie = ies[i];
            try {
                // console.log(`[Scraper] Consultando IE ${ie} (${i+1}/${ies.length})`);
                
                await page.goto('https://portal.sefaz.ba.gov.br/scripts/cadastro/cadastroBa/consultaBa.asp', { waitUntil: 'domcontentloaded', timeout: 60000 });
                
                await page.waitForSelector('input[name="IE"]', { timeout: 15000 });
                
                // Limpa e digita
                await page.$eval('input[name="IE"]', el => el.value = '');
                await page.type('input[name="IE"]', ie);

                // Clica no botão
                const btnClicked = await page.evaluate(() => {
                    const btn = document.querySelector("input[type='submit'][name='B2']");
                    if (btn) { btn.click(); return true; }
                    return false;
                });

                if (btnClicked) {
                    // Espera resultado ou erro
                    try {
                        await page.waitForFunction(
                            () => document.body.innerText.includes('Consulta Básica ao Cadastro do ICMS da Bahia') || 
                                  document.body.innerText.includes('Não foram encontrados registros') ||
                                  document.body.innerText.includes('CPF / CNPJ / IE Inválido'),
                            { timeout: 15000 }
                        );
                    } catch (waitErr) {
                        console.warn(`[Scraper] Timeout esperando resultado para ${ie}`);
                        throw new Error("Timeout waiting for response");
                    }

                    const html = await page.content();
                    const $ = cheerio.load(html);
                    const bodyText = $('body').text();

                    if (bodyText.includes('Consulta Básica ao Cadastro do ICMS da Bahia')) {
                         const extract = (label) => {
                            // Procura elemento B que contenha o label
                            const b = $(`b:contains("${label}")`).first();
                            if (b.length && b[0].nextSibling && b[0].nextSibling.nodeType === 3) {
                                return $(b[0].nextSibling).text().replace(/&nbsp;/g, ' ').trim();
                            }
                            // Tenta buscar no parent se não achar direto
                            if (b.length) return b.parent().text().replace(label, '').trim();
                            return null;
                        };

                        const dados = {
                            inscricao_estadual: ie,
                            cnpj: extract('CNPJ:') || '',
                            razao_social: extract('Razão Social:') || '',
                            municipio: extract('Município:') || '',
                            telefone: extract('Telefone:') || '',
                            situacao: extract('Situação Cadastral Vigente:') || 'Desconhecida',
                            motivo: extract('Motivo desta Situação Cadastral:') || '',
                            contador: extract('Nome:') || '' // Nome do contador
                        };

                        if (isReprocess) {
                            await runQuery(`UPDATE resultado SET situacao_cadastral = ?, motivo_situacao_cadastral = ?, status = 'Sucesso' WHERE consulta_id = ? AND inscricao_estadual = ?`, 
                            [dados.situacao, dados.motivo, processId, ie]);
                        } else {
                            await runQuery(`INSERT INTO resultado (consulta_id, inscricao_estadual, cnpj, razao_social, municipio, telefone, situacao_cadastral, motivo_situacao_cadastral, nome_contador, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Sucesso')`, 
                            [processId, ie, dados.cnpj, dados.razao_social, dados.municipio, dados.telefone, dados.situacao, dados.motivo, dados.contador]);
                        }
                    } else {
                         const erroMsg = bodyText.includes('Não foram encontrados registros') ? 'Não encontrado' : 'Erro na página';
                         if (!isReprocess) {
                             await runQuery(`INSERT INTO resultado (consulta_id, inscricao_estadual, status) VALUES (?, ?, ?)`, [processId, ie, `Erro: ${erroMsg}`]);
                         }
                    }
                }
            } catch (err) {
                console.error(`[Scraper] Erro ao processar IE ${ie}:`, err.message);
                if (!isReprocess) await runQuery(`INSERT INTO resultado (consulta_id, inscricao_estadual, status) VALUES (?, ?, ?)`, [processId, ie, `Erro: ${err.message}`]);
            }
            await runQuery("UPDATE consulta SET processed = ? WHERE id = ?", [i + 1, processId]);
            // Pequeno delay para não sobrecarregar
            await new Promise(r => setTimeout(r, 500));
        }
    } catch (e) { 
        console.error("[Scraper] Erro fatal no browser:", e); 
    } finally {
        if (browser) await browser.close();
        console.log(`[Scraper] Finalizado processo ${processId}`);
        await runQuery("UPDATE consulta SET status = 'completed', end_time = ? WHERE id = ?", [new Date().toISOString(), processId]);
    }
}

// --- Rotas API ---

app.post('/start-processing', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo' });
    const processId = uuidv4();
    try {
        await runQuery("INSERT INTO consulta (id, filename, status, start_time) VALUES (?, ?, 'processing', ?)", 
            [processId, req.file.originalname, new Date().toISOString()]);
        
        // Roda em background
        runScraping(processId, req.file.path, false);
        
        res.json({ processId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/progress/:processId', async (req, res) => {
    const { processId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const interval = setInterval(async () => {
        try {
            const row = await getOne("SELECT total, processed, status FROM consulta WHERE id = ?", [processId]);
            if (!row) {
                res.write(`data: ${JSON.stringify({ status: 'not_found' })}\n\n`);
                clearInterval(interval);
                return;
            }
            res.write(`data: ${JSON.stringify(row)}\n\n`);
            if (row.status === 'completed' || row.status === 'error') {
                res.end();
                clearInterval(interval);
            }
        } catch (e) { clearInterval(interval); }
    }, 1000);

    req.on('close', () => clearInterval(interval));
});

// Outros endpoints (get-all-results, etc) mantidos iguais
app.get('/get-all-results', async (req, res) => {
    const rows = await getQuery("SELECT * FROM resultado ORDER BY id DESC");
    res.json(rows.map(r => ({
        id: r.id.toString(),
        inscricaoEstadual: r.inscricao_estadual,
        cnpj: r.cnpj,
        razao_social: r.razao_social, // Compatible with old frontend expectation if any
        razaoSocial: r.razao_social,
        municipio: r.municipio,
        telefone: r.telefone,
        situacaoCadastral: r.situacao_cadastral,
        motivoSituacao: r.motivo_situacao_cadastral,
        nomeContador: r.nome_contador,
        status: r.status,
        campaignStatus: r.campaign_status
    })));
});

app.get('/get-imports', async (req, res) => {
    const rows = await getQuery("SELECT * FROM consulta ORDER BY start_time DESC");
    res.json(rows);
});

app.get('/api/unique-filters', async (req, res) => {
    const motivos = await getQuery("SELECT DISTINCT motivo_situacao_cadastral FROM resultado");
    const municipios = await getQuery("SELECT DISTINCT municipio FROM resultado");
    res.json({
        motivos: motivos.map(r => r.motivo_situacao_cadastral).filter(Boolean),
        municipios: municipios.map(r => r.municipio).filter(Boolean)
    });
});

app.get('/api/whatsapp/chats', async (req, res) => {
    if (whatsappStatus !== 'connected') return res.json([]);
    try {
        const chats = await client.getChats();
        res.json(chats.slice(0, 50).map(c => ({
            id: c.id._serialized,
            name: c.name || c.id.user,
            unread: c.unreadCount,
            lastMessage: c.lastMessage ? c.lastMessage.body : '',
            timestamp: c.timestamp,
            isAiDisabled: disabledAI.has(c.id._serialized)
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/whatsapp/messages/:chatId', async (req, res) => {
    if (whatsappStatus !== 'connected') return res.json([]);
    try {
        const chat = await client.getChatById(req.params.chatId);
        const messages = await chat.fetchMessages({ limit: 50 });
        res.json(messages.map(m => ({
            id: m.id.id,
            fromMe: m.fromMe,
            body: m.body,
            hasMedia: m.hasMedia,
            type: m.type,
            timestamp: m.timestamp
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/whatsapp/send', async (req, res) => {
    try {
        await client.sendMessage(req.body.chatId, req.body.message);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/whatsapp/toggle-ai', async (req, res) => {
    const { chatId, active } = req.body;
    if (active) disabledAI.delete(chatId); else disabledAI.add(chatId);
    res.json({ success: true });
});

app.get('/api/whatsapp/status', (req, res) => res.json({ status: whatsappStatus, qr: qrCodeData }));

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`[Node] Server rodando na porta ${PORT}`));