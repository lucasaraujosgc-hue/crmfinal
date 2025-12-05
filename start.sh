#!/bin/sh

echo "--- INICIANDO CONTAINER ---"

# Inicia o Backend Python (Flask) em segundo plano na porta 5000 (Localhost)
# Aumentado timeout para 300s para evitar quedas durante o scraping
echo "1. Iniciando Python (Gunicorn)..."
gunicorn -b 127.0.0.1:5000 --timeout 300 --workers 2 --log-level info app:app &

# Aguarda 5 segundos para o Python subir
echo "2. Aguardando Python..."
sleep 5

# Inicia o Servidor Principal Node.js
echo "3. Iniciando Node.js (Server)..."
node server.js
