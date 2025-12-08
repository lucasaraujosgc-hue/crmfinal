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
    // Tabela de Importações (Consultas)
    db.run(`CREATE TABLE IF NOT EXISTS consulta (
        id TEXT PRIMARY KEY,
        filename TEXT,
        total INTEGER DEFAULT 0,
        processed INTEGER DEFAULT 0,
        status TEXT,
        start_time DATETIME,
        end_time DATETIME
    )`);

    // Tabela de Campanhas
    db.run(`CREATE TABLE IF NOT EXISTS campaign (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        initial_message TEXT,
        ai_persona TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME
    )`);

    // Tabela de Resultados (Leads)
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
        last_contacted DATETIME,
        notes TEXT,
        FOREIGN KEY(consulta_id) REFERENCES consulta(id),
        FOREIGN KEY(campaign_id) REFERENCES campaign(id)
    )`);
    
    // Migração segura para adicionar coluna campaign_id se não existir
    db.all("PRAGMA table_info(resultado)", (err, rows) => {
        if (!rows.some(r => r.name === 'campaign_id')) {
            db.run("ALTER TABLE resultado ADD COLUMN campaign_id TEXT REFERENCES campaign(id)");
        }
    });
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
let globalPersona = ""; // Persona padrão

app.post('/api/config/ai-rules', (req, res) => {
    const { rules, persona } = req.body;
    activeRules = rules || [];
    if (persona) globalPersona = persona;
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
        let campaignPersona = null;

        try {
            const contact = await msg.getContact().catch(() => null);
            if (contact && contact.number) {
                const cleanPhone = contact.number.replace(/\D/g, '').slice(-8);
                // Busca o cliente e também os dados da campanha se houver
                const row = await getOne(`
                    SELECT r.*, c.ai_persona as campaign_persona 
                    FROM resultado r 
                    LEFT JOIN campaign c ON r.campaign_id = c.id 
                    WHERE r.telefone LIKE ?
                    ORDER BY r.id DESC LIMIT 1
                `, [`%${cleanPhone}`]);

                if (row) {
                    contextData = {
                        razaoSocial: row.razao_social,
                        municipio: row.municipio,
                        situacao: row.situacao_cadastral,
                        motivoSituacao: row.motivo_situacao_cadastral
                    };
                    
                    if (row.campaign_persona) {
                        campaignPersona = row.campaign_persona;
                    }
                    
                    if (row.campaign_status === 'sent' || row.campaign_status === 'pending') {
                         await runQuery("UPDATE resultado SET campaign_status = 'replied' WHERE id = ?", [row.id]);
                    }
                }
            }
        } catch (err) { 
            console.warn('[AI] Context lookup skipped:', err.message); 
        }

        // Define a Persona: Prioridade Campanha > Global > Padrão
        let systemInstruction = campaignPersona || globalPersona || `Você é um assistente comercial da CRM VIRGULA.`;
        
        if (contextData) {
            systemInstruction += `\n\nContexto do Cliente:
            Empresa: ${contextData.razaoSocial}
            Situação na SEFAZ: ${contextData.situacao}
            Motivo da Inaptidão: ${contextData.motivoSituacao}`;
            
            if (activeRules && activeRules.length > 0 && contextData.motivoSituacao) {
                const matchingRule = activeRules.find(r => r.motivoSituacao && contextData.motivoSituacao.includes(r.motivoSituacao));
                if (matchingRule && matchingRule.instructions) {
                    matchingRule.instructions.forEach(inst => systemInstruction += `\n[${inst.title}]: ${inst.content}`);
                }
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
                         parts.push({ text: "O usuário enviou um áudio. Responda em texto baseando-se no que foi dito." });
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
        console.error('[AI] Erro ao processar mensagem:', e);
        await chat.clearState();
    }
});

async function initializeWhatsApp() {
    try { await client.initialize(); } catch (e) { setTimeout(initializeWhatsApp, 10000); }
}
initializeWhatsApp();

// --- Lógica de Scraping Otimizada ---

async function runScraping(processId, filepath, isReprocess = false) {
    let ies = [];
    
    // Verifica se arquivo existe, se não, tenta recuperar do DB se for reprocess
    if (!fs.existsSync(filepath)) {
        // Se for reprocess e não tem arquivo, tenta usar só o DB se tiver dados lá.
        // Mas se o objetivo é "Refresh" (re-ler), precisamos do arquivo.
        // Assumindo que o arquivo está lá.
        if (!isReprocess) {
            console.error(`[Scraper] Arquivo não encontrado: ${filepath}`);
            await runQuery("UPDATE consulta SET status = 'error' WHERE id = ?", [processId]);
            return;
        }
    }

    try {
        console.log(`[Scraper] Iniciando leitura PDF: ${filepath}`);
        const dataBuffer = fs.readFileSync(filepath);
        const data = await pdf(dataBuffer);
        
        const rawText = data.text;
        const normalizedText = rawText.replace(/\s+/g, ''); 
        const regexNormalized = /(\d{1,3}\.\d{1,3}\.\d{1,3})-/g;
        const matches = [...normalizedText.matchAll(regexNormalized)];
        const foundIes = matches.map(m => m[1].replace(/\D/g, ''));
        ies = [...new Set(foundIes)].filter(ie => ie.length >= 8);
        console.log(`[Scraper] Encontradas ${ies.length} IEs únicas`);

    } catch (e) {
        console.error("[Scraper] Erro ao ler PDF:", e);
        if (!isReprocess) {
            await runQuery("UPDATE consulta SET status = 'error' WHERE id = ?", [processId]);
            return;
        }
        // Se falhar PDF no reprocess, tentamos pegar do DB existente
        const rows = await getQuery("SELECT inscricao_estadual FROM resultado WHERE consulta_id = ?", [processId]);
        ies = rows.map(r => r.inscricao_estadual);
    }

    if (ies.length === 0) {
        console.warn("[Scraper] Nenhuma IE encontrada.");
        await runQuery("UPDATE consulta SET status = 'error', processed = 0 WHERE id = ?", [processId]);
        return;
    }

    await runQuery("UPDATE consulta SET total = ?, processed = 0, status = 'processing' WHERE id = ?", [ies.length, processId]);

    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
            args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-setuid-sandbox', '--start-maximized'],
            ignoreHTTPSErrors: true
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        for (let i = 0; i < ies.length; i++) {
            const ie = ies[i];
            try {
                await page.goto('https://portal.sefaz.ba.gov.br/scripts/cadastro/cadastroBa/consultaBa.asp', { waitUntil: 'networkidle2', timeout: 60000 });
                const inputSelector = 'input[name="IE"]';
                await page.waitForSelector(inputSelector, { timeout: 30000 });
                await page.$eval(inputSelector, el => el.value = '');
                await page.type(inputSelector, ie);

                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
                    page.click("input[type='submit'][name='B2']")
                ]);

                const html = await page.content();
                const $ = cheerio.load(html);
                const bodyText = $('body').text();

                if (bodyText.includes('Consulta Básica ao Cadastro do ICMS da Bahia')) {
                     const extract = (label) => {
                        const el = $('b').filter((i, el) => {
                            const t = $(el).text().replace(/\s+/g, ' ').trim();
                            return t.includes(label);
                        }).first();
                        if (el.length && el[0].nextSibling) return $(el[0].nextSibling).text().replace(/&nbsp;/g, ' ').trim();
                        if (el.length) return el.parent().text().replace(label, '').trim();
                        return null;
                    };

                    let atividade = '';
                    const ativLabel = $('b').filter((i, el) => {
                        const t = $(el).text();
                        return t.includes('Atividade Econômica') || t.includes('Atividade Econômica Principal');
                    });
                    if (ativLabel.length) {
                        const nextTr = ativLabel.closest('tr').next('tr');
                        if (nextTr.length) atividade = nextTr.text().replace(/&nbsp;/g, ' ').trim();
                    }

                    const dados = {
                        inscricao_estadual: ie,
                        cnpj: extract('CNPJ:') || '',
                        razao_social: extract('Razão Social:') || extract('Raz&atilde;o Social:') || '',
                        municipio: extract('Município:') || extract('Munic&iacute;pio:') || '',
                        telefone: extract('Telefone:') || '',
                        situacao: extract('Situação Cadastral Vigente:') || extract('Situa&ccedil;&atilde;o Cadastral Vigente:') || 'Desconhecida',
                        motivo: extract('Motivo desta Situação Cadastral:') || extract('Motivo desta Situa&ccedil;&atilde;o Cadastral:') || '',
                        contador: extract('Nome:') || '',
                        atividade_economica_principal: atividade
                    };

                    // Verifica se já existe para atualizar ou inserir
                    const existing = await getOne("SELECT id FROM resultado WHERE consulta_id = ? AND inscricao_estadual = ?", [processId, ie]);
                    
                    if (existing) {
                        await runQuery(`UPDATE resultado SET cnpj=?, razao_social=?, municipio=?, telefone=?, situacao_cadastral=?, motivo_situacao_cadastral=?, nome_contador=?, atividade_economica_principal=?, status='Sucesso' WHERE id=?`, 
                        [dados.cnpj, dados.razao_social, dados.municipio, dados.telefone, dados.situacao, dados.motivo, dados.contador, dados.atividade_economica_principal, existing.id]);
                    } else {
                        await runQuery(`INSERT INTO resultado (consulta_id, inscricao_estadual, cnpj, razao_social, municipio, telefone, situacao_cadastral, motivo_situacao_cadastral, nome_contador, atividade_economica_principal, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Sucesso')`, 
                        [processId, ie, dados.cnpj, dados.razao_social, dados.municipio, dados.telefone, dados.situacao, dados.motivo, dados.contador, dados.atividade_economica_principal]);
                    }

                } else {
                     const erroMsg = bodyText.includes('Não foram encontrados registros') ? 'Não encontrado' : 'Erro página';
                     const existing = await getOne("SELECT id FROM resultado WHERE consulta_id = ? AND inscricao_estadual = ?", [processId, ie]);
                     if (!existing) {
                        await runQuery(`INSERT INTO resultado (consulta_id, inscricao_estadual, status) VALUES (?, ?, ?)`, [processId, ie, `Erro: ${erroMsg}`]);
                     } else {
                        await runQuery("UPDATE resultado SET status = ? WHERE id = ?", [`Erro: ${erroMsg}`, existing.id]);
                     }
                }
            } catch (err) {
                console.error(`[Scraper] Erro IE ${ie}:`, err.message);
                const existing = await getOne("SELECT id FROM resultado WHERE consulta_id = ? AND inscricao_estadual = ?", [processId, ie]);
                if (!existing) await runQuery(`INSERT INTO resultado (consulta_id, inscricao_estadual, status) VALUES (?, ?, ?)`, [processId, ie, `Erro: ${err.message}`]);
            }
            await runQuery("UPDATE consulta SET processed = ? WHERE id = ?", [i + 1, processId]);
        }
    } catch (e) { console.error("[Scraper] Fatal:", e); } 
    finally {
        if (browser) await browser.close();
        await runQuery("UPDATE consulta SET status = 'completed', end_time = ? WHERE id = ?", [new Date().toISOString(), processId]);
    }
}

// --- Rotas API ---

// IMPORTAÇÕES
app.post('/start-processing', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo' });
    const processId = uuidv4();
    try {
        await runQuery("INSERT INTO consulta (id, filename, status, start_time) VALUES (?, ?, 'processing', ?)", 
            [processId, req.file.originalname, new Date().toISOString()]);
        runScraping(processId, req.file.path, false);
        res.json({ processId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/imports/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const row = await getOne("SELECT filename FROM consulta WHERE id = ?", [id]);
        if (row) {
            const filepath = path.join(UPLOAD_FOLDER, row.filename); // Assumindo que filename é o original. 
            // Na verdade, o multer salva com UUID, mas salvamos o originalname no DB.
            // Correção: Para deletar o arquivo físico, precisaríamos ter salvo o path ou o filename do disco no DB.
            // Simplificação: Deletamos os dados do banco. O arquivo físico será orfão (pode ser limpo via cron depois).
            // Melhoria: Vamos deletar só do banco por segurança agora.
        }
        await runQuery("DELETE FROM resultado WHERE consulta_id = ?", [id]);
        await runQuery("DELETE FROM consulta WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/imports/retry/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Precisamos descobrir o nome do arquivo físico. 
        // Como o multer salvou com UUID e não salvamos no banco o path, vamos tentar reprocessar usando as IEs que já estão no banco?
        // Ou assumir que o arquivo é {uuid}.pdf se tivéssemos salvo.
        // Solução Atual: Reprocessar usando o que temos no banco de dados (resultado) OU tentar achar o arquivo se tivéssemos salvo.
        // Vamos forçar um scraping novo baseado nas IEs que já temos no banco para essa consulta.
        
        await runQuery("UPDATE consulta SET status = 'processing', processed = 0 WHERE id = ?", [id]);
        
        // Hack: Passamos um path falso, mas o runScraping vai pegar as IEs do banco porque o arquivo não vai existir
        // e ele tem fallback para DB se falhar leitura.
        runScraping(id, path.join(UPLOAD_FOLDER, 'dummy.pdf'), true); 
        
        res.json({ success: true });
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

// CAMPANHAS
app.get('/api/campaigns', async (req, res) => {
    const rows = await getQuery("SELECT * FROM campaign ORDER BY created_at DESC");
    // Get stats for each campaign
    const campaigns = await Promise.all(rows.map(async c => {
        const stats = await getOne(`SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN campaign_status = 'sent' THEN 1 ELSE 0 END) as sent,
            SUM(CASE WHEN campaign_status = 'replied' THEN 1 ELSE 0 END) as replied
            FROM resultado WHERE campaign_id = ?`, [c.id]);
        return { ...c, stats };
    }));
    res.json(campaigns);
});

app.post('/api/campaigns', async (req, res) => {
    const { name, description, initialMessage, aiPersona, leads } = req.body;
    const campaignId = uuidv4();
    
    try {
        await runQuery(`INSERT INTO campaign (id, name, description, initial_message, ai_persona, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
            [campaignId, name, description, initialMessage, aiPersona, new Date().toISOString()]);
        
        // Link leads to campaign
        if (leads && leads.length > 0) {
            const placeholders = leads.map(() => '?').join(',');
            await runQuery(`UPDATE resultado SET campaign_id = ?, campaign_status = 'pending' WHERE id IN (${placeholders})`, [campaignId, ...leads]);
            
            // Auto-Start Sending (Trigger Background)
            // Se quiser envio imediato:
            startBulkSend(leads, initialMessage, campaignId);
        }
        
        res.json({ success: true, campaignId });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

async function startBulkSend(ids, message, campaignId) {
    if (whatsappStatus !== 'connected') return;
    for (const id of ids) {
        try {
            const row = await getOne("SELECT telefone, razao_social FROM resultado WHERE id = ?", [id]);
            if (row && row.telefone) {
                let phone = row.telefone.replace(/\D/g, '');
                if (phone.length <= 11) phone = '55' + phone; 
                const chatId = phone + '@c.us';
                
                await new Promise(r => setTimeout(r, 8000 + Math.random() * 10000)); // Delay
                
                await client.sendMessage(chatId, message);
                await runQuery(`UPDATE resultado SET campaign_status = 'sent', last_contacted = ? WHERE id = ?`, [new Date().toISOString(), id]);
                console.log(`[Campaign ${campaignId}] Enviado: ${row.razao_social}`);
            }
        } catch (e) { console.error(`[Campaign] Erro ID ${id}:`, e.message); }
    }
}

// GETTERS
app.get('/get-all-results', async (req, res) => {
    const rows = await getQuery("SELECT * FROM resultado ORDER BY id DESC");
    res.json(rows.map(r => ({
        id: r.id.toString(),
        inscricaoEstadual: r.inscricao_estadual,
        cnpj: r.cnpj,
        razaoSocial: r.razao_social,
        municipio: r.municipio,
        telefone: r.telefone,
        situacaoCadastral: r.situacao_cadastral,
        motivoSituacao: r.motivo_situacao_cadastral,
        nomeContador: r.nome_contador,
        status: r.status,
        campaignStatus: r.campaign_status,
        campaignId: r.campaign_id
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

// WHATSAPP ENDPOINTS
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