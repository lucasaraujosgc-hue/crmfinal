# CRM VIRGULA

Sistema de CRM e Automação focado em dados da SEFAZ, com integração de IA para vendas e conexão WhatsApp.

## Funcionalidades

- **Importação de PDF SEFAZ**: Raspagem de dados e categorização automática.
- **Base de Conhecimento IA**: Crie regras específicas para cada tipo de inaptidão (Motivo SEFAZ).
- **Gestão de Campanhas**: Funil de vendas para regularização tributária.
- **Integração WhatsApp**: Interface para conexão via QR Code (Baileys/WppConnect).

## Como rodar localmente

1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Rode o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

## Deploy no Render.com

1. Crie um novo **Static Site** no Render.
2. Conecte seu repositório GitHub.
3. Configurações de Build:
   - **Build Command**: `npm run build`
   - **Publish Directory**: `dist`

---

Desenvolvido para Contadores e Consultores Tributários.
