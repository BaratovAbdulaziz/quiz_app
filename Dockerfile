FROM node:22-alpine AS base
WORKDIR /app
RUN npm i -g npm@11

FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/bot/package.json apps/bot/package.json 2>/dev/null || true
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build --workspace=@quiz-app/shared
RUN npm run build --workspace=@quiz-app/web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/next.config.js ./apps/web/next.config.js
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/app/globals.css ./apps/web/app/globals.css
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "run", "start"]
