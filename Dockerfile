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

# Stage 2: Final Image (Node + Chrome Stable)
FROM node:18-slim

# Install Google Chrome Stable and fonts
# Necessary for Puppeteer to run reliably
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built React assets
COPY --from=builder /app/dist ./dist

# Copy package.json and install Node dependencies
COPY package*.json ./

# Define Puppeteer environment variables to use installed Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Install production dependencies
RUN npm install --production

# Copy Server Code (Note: NO app.py or requirements.txt needed anymore)
COPY server.js .
COPY polyfill.js .

# Create uploads and auth directory
RUN mkdir -p sefaz_uploads whatsapp_auth

# Expose port
EXPOSE 3000

# Start command
CMD ["node", "server.js"]

