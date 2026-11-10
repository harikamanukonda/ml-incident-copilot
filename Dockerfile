FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY web ./web
COPY server.mjs ./
ENV HOST=0.0.0.0
ENV PORT=8011
EXPOSE 8011
USER node
CMD ["node", "server.mjs"]
