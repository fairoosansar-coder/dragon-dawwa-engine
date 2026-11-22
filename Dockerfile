FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY knowledge-faith/package*.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY knowledge-faith/ ./
ARG RAILWAY_GIT_COMMIT_SHA
ENV VITE_OPEN_PASSAGE=1 OPEN_PASSAGE_PUBLIC=1
RUN npm run typecheck && npm run build && mkdir -p /app/.data && chown -R node:node /app/.data
ENV NODE_ENV=production DD_PERSIST_DIR=/app/.data OPEN_PASSAGE_GATE_DB=/app/.data/gate.sqlite
USER node
CMD ["sh","-c","umask 077; if [ -z \"$DD_SIGNING_SECRET\" ]; then test -s .data/.staging-signing || node -e \"require('fs').writeFileSync('.data/.staging-signing',require('crypto').randomBytes(48).toString('hex'),{mode:384})\"; export DD_SIGNING_SECRET=$(cat .data/.staging-signing); fi; exec node --import tsx server.ts"]
