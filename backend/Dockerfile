FROM docker.io/library/node:25-alpine AS base
RUN npm install --global npm@11.20.0 --no-fund --no-audit

FROM base AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM dependencies AS development
COPY . .
EXPOSE 4000
# Temporary debugging: remove after checking the runtime connection string.
CMD ["sh", "-c", "echo \"DATABASE_URL=$DATABASE_URL\"; exec npm run dev"]

FROM dependencies AS runtime-dependencies
RUN npm prune --omit=dev

FROM base AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=runtime-dependencies /app/node_modules ./node_modules
COPY --chown=node:node . .
USER node
EXPOSE 4000
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
