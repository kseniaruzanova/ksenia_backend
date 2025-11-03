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

# Создаем только структуру пустых директорий для uploads и temp в образе
# ВАЖНО: сами папки uploads и temp с файлами исключены из образа через .dockerignore
# При запуске контейнера эти директории будут перемонтированы как bind volumes из ./uploads и ./temp
RUN mkdir -p uploads/images uploads/audio uploads/videos uploads/videos/thumbnails temp

# Открываем порт
EXPOSE 7000

# Запускаем приложение
CMD ["npm", "start"] 