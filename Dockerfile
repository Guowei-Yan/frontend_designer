FROM node:20-alpine

# Enable corepack so pnpm is available
RUN corepack enable

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the application
COPY server.js ./
COPY viewer/ ./viewer/
COPY designs/ ./designs/

# Design directory (where manifest.json and design HTML/CSS files live)
ENV DESIGN_DIR=/app/designs

# Expose the default port (Zeabur will override via PORT env var)
EXPOSE 4400

CMD ["node", "server.js"]