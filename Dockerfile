FROM node:lts-alpine

WORKDIR /app

# Копируем файлы package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Собираем TypeScript
RUN npm run build

# Открываем порт
EXPOSE 7000

# Запускаем приложение
CMD ["npm", "start"] 