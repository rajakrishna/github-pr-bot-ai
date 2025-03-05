FROM node:23.9.0-slim

WORKDIR /app

COPY package*.json ./

RUN npm install -g typescript

RUN npm install

COPY . .

RUN tsc

RUN npm run build

EXPOSE 8080

CMD ["npm", "start"] 