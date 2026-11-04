FROM node:24-bookworm-slim

ENV COREPACK_HOME=/corepack

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable \
    && corepack prepare pnpm@11.28.5 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

ENV NODE_EXTRA_CA_CERTS=/app/certs/sectigo-r36.pem

CMD ["pnpm", "extraer"]
