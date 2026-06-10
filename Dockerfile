# Production backend image.
# Stage 1 installs production-only dependencies. Keeping this separate lets the
# runtime image avoid dev dependencies while still reusing Docker cache.
FROM node:24-alpine AS prod-deps
WORKDIR /build
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Stage 2 installs full dependencies, generates Prisma Client, and compiles TS.
FROM node:24-alpine AS builder
WORKDIR /build
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma
RUN npx prisma generate && npm run build

# Stage 3 is the runtime image. It contains compiled JS, Prisma Client, Prisma
# schema/migrations, and production node_modules.
FROM node:24-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json ./
COPY --from=prod-deps /build/node_modules       ./node_modules
COPY --from=builder   /build/dist               ./dist
COPY --from=builder   /build/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

# API listens on this port inside the Docker network.
EXPOSE 4000

# Node 24 has built-in fetch, so the healthcheck does not need curl/wget.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

CMD ["dist/server.js"]
