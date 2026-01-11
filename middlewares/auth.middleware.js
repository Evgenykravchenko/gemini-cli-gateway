/**
 * @file middlewares/auth.middleware.js
 * @description Middleware для проверки API ключа в заголовках запроса.
 */

const config = require('../config/app.config');

module.exports = (req, res, next) => {
    // Список публичных путей, которые не требуют авторизации
    const publicPaths = [
        '/api/docs',   // Swagger UI и JSON спека
        '/api/health', // Health Check
        '/favicon.ico'
    ];

    // Если путь начинается с одного из публичных префиксов, пропускаем
    if (publicPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    const apiKey = req.headers['x-api-key'];
    const validApiKey = config.API_KEY;

    // Если ключ не задан в конфиге, считаем что защита выключена (или warn)
    // Но по задаче мы должны защитить. Будем строгими: если нет ключа на сервере, доступ закрыт всем (Safe fail)
    if (!validApiKey) {
        console.error('[Auth] APP_API_KEY is not set in server environment!');
        return res.status(500).json({
            status: 'error',
            message: 'Server authentication configuration error'
        });
    }

    if (!apiKey || apiKey !== validApiKey) {
        return res.status(401).json({
            status: 'error',
            message: 'Unauthorized: Invalid or missing API Key'
        });
    }

    next();
};
