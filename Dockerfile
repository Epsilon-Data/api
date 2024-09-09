# Start with a node 20 image with package info
# Installs *all* pnpm packages and runs build script
FROM node:20.9.0-alpine as workspace
WORKDIR /app
RUN npm install -g pnpm
COPY [".", "/app/"]
# TODO: add .npmrc file
# RUN pnpm login --scope=@epsilon-data --registry=https://npm.pkg.github.com
RUN pnpm install --prod --no-optional

# build app
FROM workspace as build
WORKDIR /app
# ARG APP
ENV NODE_ENV=production
# RUN pnpm build:${APP}
RUN pnpm build

FROM build as deploy
RUN pnpm db:prepare && pnpm start:prod