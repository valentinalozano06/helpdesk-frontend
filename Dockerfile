# syntax=docker/dockerfile:1

FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 4200

CMD ["npm", "start", "--", "--host", "0.0.0.0", "--port", "4200", "--poll", "2000", "--disable-host-check"]
