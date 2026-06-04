# ── Stage 1: production deps only ────────────────────────────────────────────
FROM node:24-alpine AS prod-deps
WORKDIR /build
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: full deps + prisma generate + tsc build ─────────────────────────
FROM node:24-alpine AS builder
WORKDIR /build
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
RUN npx prisma generate && npm run build

# ── Stage 3: zero-CVE runtime (no shell, no package manager) ─────────────────
FROM node:24-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json ./
COPY --from=prod-deps /build/node_modules       ./node_modules
COPY --from=builder   /build/dist               ./dist
COPY --from=builder   /build/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

EXPOSE 4000

# Node 20 has built-in fetch — no curl needed in the runtime image
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["dist/server.js"]
