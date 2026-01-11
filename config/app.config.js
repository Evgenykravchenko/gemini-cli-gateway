/**
 * @file config/app.config.js
 * @description Единый источник истины для конфигурации приложения.
 * Читает переменные окружения (.env) и типизирует их.
 */

require('dotenv').config();

const config = {
    /**
     * @type {number}
     * @description Порт сервера Express.
     */
    PORT: parseInt(process.env.PORT, 10) || 3000,

    /**
     * @type {string}
     * @description Секретный ключ для авторизации (API Key).
     */
    API_KEY: process.env.APP_API_KEY,

    /**
     * @type {string}
     * @description Текущее окружение (production/development).
     */
    NODE_ENV: process.env.NODE_ENV || 'development',

    gemini: {
        /**
         * @type {string}
         * @description ID модели по умолчанию.
         */
        DEFAULT_MODEL: process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash-lite',

        /**
         * @type {number}
         * @description Максимальное время ожидания ответа CLI (мс).
         */
        TIMEOUT_MS: parseInt(process.env.GEMINI_REQUEST_TIMEOUT_MS, 10) || 60000,

        /**
         * @type {string}
         * @description Команда запуска CLI (или путь к бинарнику).
         */
        CLI_COMMAND: process.env.GEMINI_CLI_COMMAND || 'gemini',

        /**
         * @type {number}
         * @description Максимальное количество одновременных процессов (очередь).
         */
        MAX_CONCURRENT_REQUESTS: parseInt(process.env.GEMINI_MAX_CONCURRENT_REQUESTS, 10) || 2
    },

    /**
     * @constant {Array}
     * @description Список доступных моделей (статичный справочник).
     */
    AVAILABLE_MODELS: [
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'Fastest, low cost' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Balanced performance' }
    ]
};

module.exports = config;