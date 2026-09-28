FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG DEPLOY_ENV=production
ARG VITE_GA_MEASUREMENT_ID
ARG VITE_AUDIO_UNLOCK_SCOPE=apple
ARG VITE_AUDIO_DEBUG=false
ARG VITE_SOUND_BASE_URL=/sound
ENV DEPLOY_ENV=$DEPLOY_ENV \
    VITE_GA_MEASUREMENT_ID=$VITE_GA_MEASUREMENT_ID \
    VITE_AUDIO_UNLOCK_SCOPE=$VITE_AUDIO_UNLOCK_SCOPE \
    VITE_AUDIO_DEBUG=$VITE_AUDIO_DEBUG \
    VITE_SOUND_BASE_URL=$VITE_SOUND_BASE_URL
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && mkdir -p /app/logs && chown node:node /app/logs
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node api ./api
COPY --chown=node:node server ./server
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node public/sound ./public/sound
USER node
EXPOSE 3000
CMD ["node", "server/index.mjs"]
