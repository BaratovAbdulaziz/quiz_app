FROM node:22-alpine AS base
RUN npm i -g npm@11
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/next.config.js ./apps/web/next.config.js
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/app/globals.css ./apps/web/app/globals.css
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/turbo.json ./turbo.json
EXPOSE 3000
CMD ["npm", "run", "start"]
