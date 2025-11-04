# Start with a node 24 image
# Installs *all* pnpm packages and runs build script
FROM node:24.11.0-alpine AS workspace

# Install docker CLI (client only, no daemon) for postinstall script
RUN apk add --no-cache docker-cli

# private git packages creds
ARG GITHUB_NPM_TOKEN
ENV GITHUB_NPM_TOKEN=${GITHUB_NPM_TOKEN}

# broker image name
ARG BROKER_IMAGE
ENV BROKER_IMAGE=${BROKER_IMAGE}

WORKDIR /app
# install packages
RUN npm install -g pnpm
COPY [".", "/app/"]
RUN pnpm install

# build app
FROM workspace AS build
WORKDIR /app
ENV NODE_ENV=production
RUN pnpm build

CMD pnpm run