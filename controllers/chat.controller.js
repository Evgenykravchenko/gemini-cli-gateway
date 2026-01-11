/**
 * @file controllers/chat.controller.js
 * @description Контроллер, обрабатывающий входящие HTTP запросы.
 * Связывает маршруты API с бизнес-логикой сервиса GeminiService.
 */

const geminiService = require('../services/gemini.service');
const config = require('../config/app.config');

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 */

class ChatController {

    /**
     * Возвращает список доступных конфигураций моделей.
     * GET /api/models
     * @param {Request} req - Объект запроса Express.
     * @param {Response} res - Объект ответа Express.
     */
    getModels(req, res) {
        res.json({
            default_model: config.gemini.DEFAULT_MODEL,
            available_models: config.AVAILABLE_MODELS
        });
    }

    /**
     * Проверяет работоспособность сервиса и наличие CLI утилиты.
     * GET /api/health
     * @param {Request} req
     * @param {Response} res
     */
    healthCheck(req, res) {
        const child = geminiService.checkHealth();

        // Если процесс не удалось запустить (например, gemini не установлен)
        child.on('error', () => {
            return res.status(503).json({
                status: 'error',
                code: 'CLI_NOT_FOUND',
                message: 'Gemini CLI binary is not accessible'
            });
        });

        // Слушаем код выхода процесса
        child.on('close', (code) => {
            if (code === 0) {
                res.json({
                    status: 'ok',
                    uptime: process.uptime(), // Время работы сервера в секундах
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(503).json({
                    status: 'error',
                    code: 'CLI_ERROR',
                    message: `Health check failed with exit code ${code}`
                });
            }
        });
    }

    /**
     * Обрабатывает стандартный запрос чата (Request -> Response).
     * Ждет полного завершения генерации перед отправкой ответа.
     * POST /api/chat
     * @param {Request} req
     * @param {Response} res
     */
    async handleStandardChat(req, res) {
        const { prompt, system, model } = req.body;

        // 1. Валидация входных данных
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ error: 'Field "prompt" is required and must be a string' });
        }

        const selectedModel = model || config.gemini.DEFAULT_MODEL;

        // Валидация модели: проверяем, есть ли такой ID в списке разрешенных
        const isModelValid = config.AVAILABLE_MODELS.some(m => m.id === selectedModel);
        if (!isModelValid) {
            return res.status(400).json({ 
                error: `Invalid model ID: '${selectedModel}'. Available models: ${config.AVAILABLE_MODELS.map(m => m.id).join(', ')}` 
            });
        }

        // 2. Запуск процесса через сервис (с ожиданием очереди)
        const child = await geminiService.createProcessBuffered(system, prompt, selectedModel, false);

        // Обработка ошибки запуска процесса (например, command not found)
        child.on('error', (err) => {
            console.error('[Spawn Error]', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to spawn CLI process', details: err.message });
            }
        });

        let output = '';
        let errorOut = '';
        let isTimedOut = false;

        // 3. Установка таймера безопасности (Watchdog timer)
        // Если CLI зависнет, мы принудительно убьем процесс через TIMEOUT_MS
        const timer = setTimeout(() => {
            isTimedOut = true;
            child.kill(); // SIGTERM
            if (!res.headersSent) {
                res.status(504).json({ error: 'Gateway Timeout: Model took too long to respond' });
            }
        }, config.gemini.TIMEOUT_MS);

        // 4. Сбор данных из потоков вывода (stdout/stderr)
        child.stdout.on('data', (chunk) => { output += chunk.toString(); });
        child.stderr.on('data', (chunk) => { errorOut += chunk.toString(); });

        // 5. Обработка завершения процесса
        child.on('close', (code) => {
            clearTimeout(timer); // Очищаем таймер, так как процесс завершился
            if (isTimedOut) return; // Если уже ответили ошибкой таймаута, ничего не делаем

            if (code !== 0) {
                // Логируем ошибку, но клиенту отдаем JSON с описанием
                console.error(`[Chat Error] CLI stderr: ${errorOut}`);
                return res.status(500).json({
                    status: 'error',
                    message: 'CLI execution failed',
                    details: errorOut
                });
            }

            // Успешный ответ
            res.json({
                status: 'success',
                model: selectedModel,
                response: output.trim()
            });
        });
    }

    /**
     * Обрабатывает потоковый запрос (Server-Sent Events).
     * Позволяет клиенту получать ответ по частям в реальном времени.
     * POST /api/chat/stream
     * @param {Request} req
     * @param {Response} res
     */
    async handleStreamChat(req, res) {
        const { prompt, system, model } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Field "prompt" is required' });
        }

        const selectedModel = model || config.gemini.DEFAULT_MODEL;

        // Валидация модели
        const isModelValid = config.AVAILABLE_MODELS.some(m => m.id === selectedModel);
        if (!isModelValid) {
            return res.status(400).json({ 
                error: `Invalid model ID: '${selectedModel}'.` 
            });
        }

        // 1. Установка заголовков для SSE (Server-Sent Events)
        // Это сообщает браузеру/клиенту не закрывать соединение
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // Принудительная отправка заголовков

        // 2. Запуск процесса в режиме streaming JSON (с ожиданием очереди)
        const child = await geminiService.createProcessBuffered(system, prompt, selectedModel, true);

        // Обработка ошибки запуска процесса
        child.on('error', (err) => {
            console.error('[Stream Spawn Error]', err);
            // Если заголовки еще не ушли (хотя для стрима мы их уже отправили выше),
            // можно попробовать отправить event error.
            // Но так как мы уже сделали flashHeaders, мы пишем в поток ошибку.
            res.write(`event: error\ndata: {"message": "Failed to spawn process: ${err.message}"}\n\n`);
            res.end();
        });

        let buffer = '';

        // 3. Обработка потока данных
        child.stdout.on('data', (chunk) => {
            buffer += chunk.toString();
            
            let boundary = buffer.indexOf('\n');
            while (boundary !== -1) {
                const line = buffer.substring(0, boundary).trim();
                buffer = buffer.substring(boundary + 1);
                
                if (line) {
                    // Пишем в HTTP ответ в формате SSE: "data: ... \n\n"
                    res.write(`data: ${line}\n\n`);
                }
                
                boundary = buffer.indexOf('\n');
            }
        });

        // Опционально: логирование ошибок стрима в консоль сервера
        child.stderr.on('data', (chunk) => console.error(`[Stream Warning]: ${chunk}`));

        // 4. Завершение стрима
        child.on('close', () => {
            // Отправляем специальное событие окончания
            res.write('event: done\ndata: [DONE]\n\n');
            res.end(); // Закрываем HTTP соединение
        });

        // 5. Обработка разрыва соединения клиентом
        // Если пользователь закрыл вкладку браузера, убиваем процесс CLI для экономии ресурсов
        req.on('close', () => {
            if (!child.killed) {
                console.log('[Stream] Client disconnected -> killing CLI process');
                child.kill();
            }
        });
    }
}

module.exports = new ChatController();