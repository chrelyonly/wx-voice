FROM node:20-alpine

RUN npm install wx-voice -g --registry https://registry.npmmirror.com
RUN sed -i 's|https://dl-cdn.alpinelinux.org|https://mirrors.aliyun.com|g' /etc/apk/repositories && \
    apk update && apk add --no-cache ffmpeg
RUN apk add --no-cache make build-base
RUN wx-voice compile
