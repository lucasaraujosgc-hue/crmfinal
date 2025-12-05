# Stage 1: Build the React application
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the project
RUN npx vite build

# Stage 2: Final Image (Node + Python + Chrome)
FROM node:18-slim

# Install Python, Chrome and Utilities
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    wget \
    gnupg \
    unzip \
    curl \
    dos2unix \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y ./google-chrome-stable_current_amd64.deb \
    && rm google-chrome-stable_current_amd64.deb \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- INSTALAÇÃO DINÂMICA DO CHROMEDRIVER ---
# Usa Python para pegar a URL exata do driver estável da API do Google
RUN python3 -c "import json, urllib.request; \
    data = json.loads(urllib.request.urlopen('https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json').read()); \
    print(data['channels']['Stable']['downloads']['chromedriver'][0]['url'])" > driver_url.txt && \
    wget -q -i driver_url.txt -O chromedriver.zip && \
    unzip chromedriver.zip && \
    # A pasta descompactada pode variar, então usamos find para mover o binário
    find . -name "chromedriver" -type f -exec mv {} /usr/bin/chromedriver \; && \
    chmod +x /usr/bin/chromedriver && \
    rm -rf chromedriver.zip driver_url.txt

# Copy built React assets
COPY --from=builder /app/dist ./dist

# Copy package.json and install Node dependencies
COPY package*.json ./
RUN npm install --production

# Install Python requirements
COPY requirements.txt .
# Create a virtual env
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install gunicorn

# Copy Application Code
COPY server.js .
COPY app.py .
COPY start.sh .

# Fix line endings & permissions
RUN dos2unix start.sh && \
    chmod +x start.sh

# Create uploads directory
RUN mkdir -p sefaz_uploads

# Define env variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
ENV CHROMEDRIVER_PATH=/usr/bin/chromedriver

# Expose port
EXPOSE 3000

# Start
CMD ["/bin/sh", "start.sh"]
