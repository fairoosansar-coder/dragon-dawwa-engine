FROM docker.io/library/node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm ci --prefix deployment/staging/identity --no-audit --no-fund && npm run lint && npm run build
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "deployment/staging/start-app.mjs"]
