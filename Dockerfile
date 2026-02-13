# Dockerfile para Railway - Backend DSICOLA
# Railway usa este ficheiro automaticamente (nome exato "Dockerfile")
# Serviço Backend: Root Directory = vazio (.)

FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./
COPY backend/prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY backend/ ./

RUN npm run build

FROM node:20-alpine AS production

RUN apk add --no-cache postgresql-client

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/prisma ./prisma/
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
