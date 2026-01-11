# -------------------------------------------------------------------
# Dockerfile для Gemini API Gateway
# Оптимизирован для Raspberry Pi (поддержка ARM64/v7 через node:20-slim)
# -------------------------------------------------------------------

# 1. Используем официальный легкий образ Node.js 20 (LTS)
# Версия slim весит меньше, но содержит все необходимое для запуска.
FROM node:20-slim

# 2. Метаданные образа (Optional labels)
LABEL maintainer="Evgeny Kravchenko"
LABEL description="Gemini CLI Wrapper API"

# 3. Установка системных зависимостей
# Устанавливаем curl для healthcheck'ов и ca-certificates для HTTPS.
# clean очищает кэш apt для уменьшения размера образа.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 4. Установка рабочей директории
WORKDIR /app

# 5. Кэширование зависимостей
# Сначала копируем только файлы package.json, чтобы Docker мог закэшировать
# слой с node_modules, если код меняется, а зависимости нет.
COPY package.json ./

# Устанавливаем только production зависимости (без devDependencies)
RUN npm install --production

# 6. Установка Gemini CLI
# Устанавливаем глобально, чтобы команда 'gemini' была доступна в PATH.
RUN npm install -g @google/gemini-cli

# 7. Копирование исходного кода приложения
# Копируем все файлы проекта в контейнер.
COPY . .

# 8. Настройка переменных окружения по умолчанию
ENV PORT=3000
ENV NODE_ENV=production

# 9. Объявление порта
# Сообщаем Docker, что контейнер слушает порт 3000.
EXPOSE 3000

# 10. Точка входа
# Запускаем приложение через node.
CMD ["node", "app.js"]