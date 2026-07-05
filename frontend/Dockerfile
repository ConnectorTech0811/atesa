# ============================================================
# ATESA Frontend - Multi-stage Production Dockerfile
# ============================================================
# Build context: ./frontend (este diretório)
# Usage: docker compose up --build
# ============================================================

# ------------------ Stage 1: Build --------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar dependências primeiro (cache de camadas)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copiar o restante do código-fonte
COPY . .

# Variáveis de ambiente injetáveis no build (identidade visual e API)
ARG VITE_API_URL
ARG VITE_APP_NAME
ARG VITE_BRAND_PRIMARY_COLOR
ARG VITE_BRAND_PRIMARY_DARK
ARG VITE_BRAND_PRIMARY_LIGHT
ARG VITE_BRAND_SECONDARY_COLOR
ARG VITE_BRAND_BACKGROUND
ARG VITE_BRAND_LOGO
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_BRAND_PRIMARY_COLOR=${VITE_BRAND_PRIMARY_COLOR}
ENV VITE_BRAND_PRIMARY_DARK=${VITE_BRAND_PRIMARY_DARK}
ENV VITE_BRAND_PRIMARY_LIGHT=${VITE_BRAND_PRIMARY_LIGHT}
ENV VITE_BRAND_SECONDARY_COLOR=${VITE_BRAND_SECONDARY_COLOR}
ENV VITE_BRAND_BACKGROUND=${VITE_BRAND_BACKGROUND}
ENV VITE_BRAND_LOGO=${VITE_BRAND_LOGO}

# Gerar build de produção
RUN npm run build

# ------------------ Stage 2: Serve --------------------------
FROM nginx:1.27-alpine AS production

# Remover configuração padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar configuração customizada do Nginx
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copiar artefatos do build
COPY --from=builder /app/dist /usr/share/nginx/html

# Expor porta 80
EXPOSE 80

# Healthcheck para monitoramento
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

# Iniciar Nginx em foreground
CMD ["nginx", "-g", "daemon off;"]
