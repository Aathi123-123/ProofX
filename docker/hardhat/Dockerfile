FROM node:20-alpine

WORKDIR /app

RUN npm install -g hardhat

COPY package*.json ./
RUN npm ci

EXPOSE 8545
