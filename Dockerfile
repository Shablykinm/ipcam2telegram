FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./

RUN apk add --no-cache --virtual .build-deps \
    python3 \
    make \
    g++ \
    git \
    autoconf \
    automake \
    libtool \
    nasm
RUN npm install
COPY . .

FROM node:20-alpine
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app .

# Устанавливаем все зависимости в финальном образе
RUN apk add --no-cache \
    ffmpeg \
    freetype \
    fontconfig \
    ttf-freefont \
    soxr \
    lame \
    libass \
    libtheora \
    libvorbis \
    libvpx \
    x264-dev \
    x265-dev \
    libc6-compat \
    libgomp \
    libstdc++

EXPOSE 2121
CMD ["npm", "start"]