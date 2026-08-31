FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm install

RUN npx prisma generate

RUN npm prune --omit=dev

COPY . .

EXPOSE 4000

CMD ["node", "index.js"]