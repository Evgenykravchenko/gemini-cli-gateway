/**
 * @file app.js
 * @description Точка входа в приложение. Инициализация Express сервера, Middleware и запуск прослушивания порта.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const apiRoutes = require('./routes/api.routes');
const config = require('./config/app.config');

const app = express();

// --- Middlewares ---

/**
 * Логирование HTTP запросов.
 */
app.use(morgan('dev'));

/**
 * Включение CORS (Cross-Origin Resource Sharing).
 * Позволяет делать запросы к API с других доменов (например, с фронтенда).
 */
app.use(cors());

/**
 * Парсинг входящих JSON запросов.
 */
app.use(express.json());

// --- Routes ---

// Подключение всех API маршрутов под префиксом /api
app.use('/api', apiRoutes);

// --- Server Start ---

const server = app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`🚀 Gemini API Gateway running on port ${config.PORT}`);
    console.log(`👉 Health Check: http://localhost:${config.PORT}/api/health`);
    console.log(`🤖 Default Model: ${config.gemini.DEFAULT_MODEL}`);
    console.log(`=========================================`);
});

// --- Graceful Shutdown ---

/**
 * Обработка сигнала завершения (например, при остановке Docker контейнера).
 * Позволяет корректно закрыть текущие соединения перед выходом.
 */
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});