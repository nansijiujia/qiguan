FROM node:18-alpine

RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

WORKDIR /app

COPY package*.json ./

RUN npm config set registry https://mirrors.cloud.tencent.com/npm/ && \
    npm install --production && \
    npm cache clean --force

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
