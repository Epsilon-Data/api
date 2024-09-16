# Start with a node 20 image with package info
# Installs *all* pnpm packages and runs build script
FROM node:20.9.0-alpine AS workspace

# private git packages
ARG GITHUB_NPM_TOKEN
ENV GITHUB_NPM_TOKEN=${GITHUB_NPM_TOKEN}

WORKDIR /app
RUN npm install -g pnpm
COPY [".", "/app/"]
# TODO: add .npmrc file
# RUN pnpm login --scope=@epsilon-data --registry=https://npm.pkg.github.com
RUN pnpm install

# build app
FROM workspace AS build
WORKDIR /app
# ARG APP
ENV NODE_ENV=production
# RUN pnpm build:${APP}
RUN pnpm build

FROM build AS deploy
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN pnpm db:prepare && pnpm start:prod