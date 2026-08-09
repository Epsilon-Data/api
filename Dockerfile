# Start with a node 22 image
# Installs *all* pnpm packages and runs build script
FROM node:22.21.1-alpine AS workspace

# Install docker CLI (client only, no daemon) for postinstall script
RUN apk add --no-cache docker-cli

# private git packages creds
ARG GITHUB_NPM_TOKEN
ENV GITHUB_NPM_TOKEN=${GITHUB_NPM_TOKEN}
# .npmrc reads ${NODE_AUTH_TOKEN} (CI convention); expose the same token under that name for the Docker build
ENV NODE_AUTH_TOKEN=${GITHUB_NPM_TOKEN}

# broker image name
ARG BROKER_IMAGE
ENV BROKER_IMAGE=${BROKER_IMAGE}

WORKDIR /app
# install packages (pin to pnpm 10 — v11 drops package.json pnpm.overrides, breaking the lockfile)
RUN npm install -g pnpm@10
COPY [".", "/app/"]
# pnpm ignores ${VAR} auth in a committed project .npmrc (security); write the token to the trusted user-level file
RUN echo "//npm.pkg.github.com/:_authToken=${GITHUB_NPM_TOKEN}" > /root/.npmrc
RUN pnpm install

# build app
FROM workspace AS build
WORKDIR /app
ENV NODE_ENV=production
RUN pnpm build

CMD pnpm run