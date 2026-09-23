FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache dumb-init
RUN addgroup -S gai && adduser -S gai -G gai

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY scripts/data-source.prod.cjs ./scripts/data-source.prod.cjs
COPY scripts/docker-entrypoint.prod.sh ./scripts/docker-entrypoint.prod.sh

RUN chmod +x ./scripts/docker-entrypoint.prod.sh \
  && chown -R gai:gai /app

USER gai
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["./scripts/docker-entrypoint.prod.sh"]

FROM deps AS dev
RUN apk add --no-cache bash netcat-openbsd
COPY . .
EXPOSE 3000
ENTRYPOINT ["bash", "scripts/docker-entrypoint.sh"]
