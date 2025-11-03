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

# Создаем структуру директорий для uploads и temp только в образе
# ВАЖНО: сами папки uploads и temp исключены из образа через .dockerignore,
# но создаем структуру subdir'ов на случай, если volumes не будут смонтированы
# При запуске контейнера эти директории будут перемонтированы как bind volumes из ./uploads и ./temp
RUN mkdir -p uploads/images uploads/audio uploads/videos uploads/videos/thumbnails temp && \
    chmod -R 755 uploads temp

# Открываем порт
EXPOSE 7000

# Запускаем приложение
CMD ["npm", "start"] 