FROM node:24.19.0-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable pnpm \
  && corepack install -g pnpm@10.28.1

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY prisma ./prisma

COPY prisma.config.ts ./

COPY nest-cli.json tsconfig.json tsconfig.build.json ./

RUN DATABASE_URL=postgresql://ci:ci@localhost:5432/ci pnpm exec prisma generate

COPY src ./src

RUN pnpm build


FROM builder AS migrator

CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]


FROM node:24.19.0-bookworm-slim AS prod-deps

WORKDIR /app

RUN corepack enable pnpm \
  && corepack install -g pnpm@10.28.1

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile


FROM node:24.19.0-bookworm-slim AS runtime

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/src/main"]