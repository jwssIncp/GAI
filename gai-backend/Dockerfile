FROM node:22-alpine AS base

WORKDIR /app

RUN apk add --no-cache bash

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

FROM base AS dev

EXPOSE 3000

ENTRYPOINT ["bash", "scripts/docker-entrypoint.sh"]
