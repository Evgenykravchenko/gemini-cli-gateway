/**
 * @file app.js
 * @description Точка входа в приложение. Инициализация Express сервера, Middleware и запуск прослушивания порта.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config/app.config');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const OpenApiValidator = require('express-openapi-validator');
const path = require('path');

const app = express();

const swaggerDocument = YAML.load('./openapi.yaml');

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

// --- Public Routes (Before Auth) ---

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

/**
 * Аутентификация по API ключу.
 * Проверяет заголовок x-api-key для всех маршрутов кроме публичных.
 */
const authMiddleware = require('./middlewares/auth.middleware');
app.use(authMiddleware);

/**
 * Swagger UI Documentation.
 */
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Spec-First Validation & Routing
app.use(
    OpenApiValidator.middleware({
        apiSpec: './openapi.yaml',
        validateRequests: true,
        validateResponses: false,
        ignorePaths: (path) => path.startsWith('/api/docs'),
        operationHandlers: path.join(__dirname, 'controllers'), // Enable auto-routing
    }),
);

// --- Routes ---
// Маршруты теперь автоматически генерируются на основе openapi.yaml и поля x-eov-operation-handler


// Global Error Handler
app.use((err, req, res, next) => {
    // Format validation errors
    if (err.status || err.errors) {
        return res.status(err.status || 500).json({
            status: 'error',
            message: err.message,
            errors: err.errors,
        });
    }
    next(err);
});

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