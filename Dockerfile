FROM node:26-alpine

WORKDIR /app

RUN apk add --no-cache libc6-compat postgresql-client

COPY package*.json ./

RUN npm ci

COPY . .