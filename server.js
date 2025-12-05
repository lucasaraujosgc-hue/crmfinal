import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import fs from 'fs';
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- IA Logic & Config ---
const API_KEY = process.env.API_KEY || process.env.GOOGLE_API_KEY;
let activeRules = []; // Regras em memória, enviadas pelo frontend

if (API_KEY) {
    console.log('[AI] Google Gemini configurado.');
} else {
    console.warn('[AI] AVISO: API_KEY não encontrada.');
}

const disabledAI = new Set();

// Endpoint para atualizar regras vindas do frontend
app.post('/api/config/ai-rules', (req, res) => {
    const { rules } = req.body;
    activeRules = rules || [];
    console.log(`[AI] ${activeRules.length} regras de conhecimento atualizadas.`);
    res.json({ success: true });
});

// --- WhatsApp Logic ---
let qrCodeData = null;
let whatsappStatus = 'disconnected';

if (!fs.existsSync('./whatsapp_auth')) {
    fs.mkdirSync('./whatsapp_auth');
}

const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './whatsapp_auth' }),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', async (qr) => {
    try {
        qrCodeData = await QRCode.toDataURL(qr);
        whatsappStatus = 'qr_ready';
    } catch (err) { console.error(err); }
});

client.on('ready', () => {
    console.log('[WhatsApp] Conectado!');
    whatsappStatus = 'connected';
    qrCodeData = null;
});

client.on('disconnected', () => {
    whatsappStatus = 'disconnected';
    qrCodeData = null;
    setTimeout(initializeWhatsApp, 5000);
});

// Lógica de Mensagem com Contexto
client.on('message', async msg => {
    if (!API_KEY) return; 
    if (msg.fromMe) return;

    const chat = await msg.getChat();
    
    // Ignora grupos ou status
    if (chat.isGroup) return;

    if (disabledAI.has(chat.id._serialized)) {
        return;
    }

    // Delay natural
    await new Promise(r => setTimeout(r, 4000 + Math.random() * 2000));
    await chat.sendStateTyping();

    try {
        // 1. Identificar Empresa no Python
        let contextData = null;
        try {
            const contact = await msg.getContact();
            const phoneNumber = contact.number; 
            // Chamada interna para o Python (localhost:5000)
            const checkRes = await fetch(`http://127.0.0.1:5000/api/identify-contact/${phoneNumber}`);
            if (checkRes.ok) {
                const data = await checkRes.json();
                if (data.found) contextData = data;
            }
        } catch (err) {
            console.error('[AI] Falha ao identificar contato:', err.message);
        }

        // 2. Construir System Instruction
        let systemInstruction = `Você é um assistente comercial da CRM VIRGULA, especializado em regularização fiscal na Bahia.
        Seu tom deve ser profissional, empático e focado em resolver o problema do cliente.
        Use linguagem clara, evite juridiquês excessivo.`;

        if (contextData) {
            systemInstruction += `\n\nDADOS DO CLIENTE:
            Razão Social: ${contextData.razaoSocial}
            Município: ${contextData.municipio}
            Situação: ${contextData.situacao}
            Motivo da Inaptidão: "${contextData.motivoSituacao}"`;

            // Buscar regra específica
            const matchingRule = activeRules.find(r => 
                contextData.motivoSituacao && r.motivoSituacao && 
                contextData.motivoSituacao.includes(r.motivoSituacao)
            );

            if (matchingRule) {
                systemInstruction += `\n\nINSTRUÇÕES ESPECÍFICAS PARA ESTE CASO:`;
                matchingRule.instructions.forEach(inst => {
                    systemInstruction += `\n- [${inst.title}]: ${inst.content}`;
                });
            } else {
                systemInstruction += `\n\n(Não há instruções específicas cadastradas para este motivo exato, use seu conhecimento geral sobre ICMS/SEFAZ BA).`;
            }
        } else {
            systemInstruction += `\n\n(Cliente não identificado na base de dados. Trate como um lead novo interessado em regularização).`;
        }

        // 3. Preparar Conteúdo (Texto ou Áudio)
        const parts = [{ text: systemInstruction }];
        
        let userMessage = "";
        
        // Verifica se tem áudio
        if (msg.hasMedia) {
            const media = await msg.downloadMedia();
            if (media && media.mimetype.startsWith('audio/')) {
                console.log('[AI] Processando mensagem de áudio...');
                parts.push({
                    inlineData: {
                        mimeType: media.mimetype,
                        data: media.data
                    }
                });
                parts.push({ text: "O usuário enviou um áudio. Responda em texto de forma cordial." });
            } else if (msg.body) {
                userMessage = msg.body;
            }
        } else {
            userMessage = msg.body;
        }

        if (userMessage) {
            parts.push({ text: `Cliente: "${userMessage}"` });
        }

        // 4. Gerar Resposta
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: parts }
        });

        const replyText = response.text;
        if (replyText) {
            await chat.sendMessage(replyText);
        }

    } catch (e) {
        console.error('[AI] Erro:', e);
    }
});

async function initializeWhatsApp() {
    try {
        await client.initialize();
    } catch (e) {
        console.error("[WhatsApp] Erro:", e.message);
        setTimeout(initializeWhatsApp, 10000);
    }
}

initializeWhatsApp();

// --- Endpoints ---

app.get('/api/whatsapp/chats', async (req, res) => {
    if (whatsappStatus !== 'connected') return res.json([]);
    try {
        const chats = await client.getChats();
        const formatted = chats.slice(0, 50).map(c => ({
            id: c.id._serialized,
            name: c.name || c.id.user,
            unread: c.unreadCount,
            lastMessage: c.lastMessage ? c.lastMessage.body : '',
            timestamp: c.timestamp,
            isAiDisabled: disabledAI.has(c.id._serialized)
        }));
        res.json(formatted);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/whatsapp/messages/:chatId', async (req, res) => {
    try {
        const chat = await client.getChatById(req.params.chatId);
        // Aumentando limite e tratando possível lentidão
        const messages = await chat.fetchMessages({ limit: 60 }); 
        
        res.json(messages.map(m => ({
            id: m.id.id,
            fromMe: m.fromMe,
            body: m.body,
            hasMedia: m.hasMedia,
            type: m.type,
            timestamp: m.timestamp
        })));
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/whatsapp/send', async (req, res) => {
    try {
        const { chatId, message } = req.body;
        await client.sendMessage(chatId, message);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/whatsapp/toggle-ai', (req, res) => {
    const { chatId, active } = req.body;
    if (active) {
        disabledAI.delete(chatId);
    } else {
        disabledAI.add(chatId);
    }
    res.json({ success: true, aiActive: !disabledAI.has(chatId) });
});

app.get('/api/whatsapp/status', (req, res) => {
    res.json({ status: whatsappStatus, qr: qrCodeData });
});

// Proxy setup
const pythonProxy = createProxyMiddleware({
    target: 'http://127.0.0.1:5000',
    changeOrigin: true,
    ws: true, 
    logLevel: 'error', 
    onError: (err, req, res) => {
        if (!res.headersSent) res.status(502).json({ error: 'Backend Python indisponível.' });
    }
});

// Proxy all API routes
app.use('/start-processing', pythonProxy);
app.use('/reprocess', pythonProxy);
app.use('/progress', pythonProxy);
app.use('/get-all-results', pythonProxy);
app.use('/get-results', pythonProxy);
app.use('/get-imports', pythonProxy);
app.use('/api/unique-filters', pythonProxy); 
// Note: api/identify-contact is internal only usually, but proxied for testing

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Node] Rodando na porta ${PORT}`);
});