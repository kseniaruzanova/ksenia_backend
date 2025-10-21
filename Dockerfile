FROM node:lts-alpine

WORKDIR /app

# Устанавливаем FFmpeg и необходимые зависимости
RUN apk add --no-cache \
    ffmpeg \
    font-noto \
    fontconfig \
    && fc-cache -f

# Копируем файлы package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Собираем TypeScript
RUN npm run build

# Создаем необходимые директории для uploads и temp
RUN mkdir -p uploads/images uploads/audio uploads/videos temp && \
    chmod -R 755 uploads temp

# Открываем порт
EXPOSE 7000

# Запускаем приложение
CMD ["npm", "start"] 