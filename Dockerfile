# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache python3 make g++ build-base
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build the application
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV MANGA_DIR=/manga
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets (covers dir will be mounted as a volume)
COPY --from=build /app/public ./public

# Create writable directories
RUN mkdir -p /app/data /app/public/covers
RUN chown -R nextjs:nodejs /app/data /app/public/covers

# Copy standalone build output
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
