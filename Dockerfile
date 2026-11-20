# syntax=docker/dockerfile:1

FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 8080

CMD ["npm", "start", "--", "--host", "0.0.0.0", "--port", "8080", "--poll", "2000", "--disable-host-check"]
