# Dockerfile para desarrollo local — NO usar en producción
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias (incluyendo devDependencies para nodemon)
COPY package*.json ./
RUN npm install

COPY src/ ./src/

ENV NODE_ENV=development
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "run", "dev"]