#STAGE - 1: BUILD

FROM node:20-alpine as build

WORKDIR /app

COPY package.json .

RUN yarn --ignore-engines --production && \
    yarn cache clean

COPY . .

EXPOSE 8080

CMD [ "yarn", "start" ]

