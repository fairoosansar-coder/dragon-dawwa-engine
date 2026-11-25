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
CMD ["sh","-ec","umask 077; node scripts/staging-volume.cjs; export DD_PERSIST_DIR=/app/.data/live OPEN_PASSAGE_GATE_DB=/app/.data/live/gate.sqlite OP_RECOVERED_REPORT_DIR=/app/.data/live/recovered-reports; unset OP_RESTORE_ACCESS_KEY_ID OP_RESTORE_SECRET_ACCESS_KEY; export DD_SIGNING_SECRET=${DD_SIGNING_SECRET:-$(cat /app/.data/live/.staging-signing)}; exec setpriv --reuid=node --regid=node --init-groups node --import tsx server.ts"]
