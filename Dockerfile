# One container = website + multiplayer server (works on Render, Railway, Fly.io, any VPS)
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
# Contact details shown on the Privacy Policy and Terms pages (set them in Render → Environment)
ARG VITE_OPERATOR_NAME
ARG VITE_SUPPORT_EMAIL
RUN npx vite build
ENV PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
