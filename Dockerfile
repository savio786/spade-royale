# One container = website + multiplayer server (works on Render, Railway, Fly.io, any VPS)
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx vite build
ENV PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
