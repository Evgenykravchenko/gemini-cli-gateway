/**
 * @file services/gemini.service.js
 * @description Сервисный слой для взаимодействия с утилитой командной строки Google Gemini CLI.
 * Отвечает за формирование аргументов и порождение дочерних процессов ОС.
 */

const { spawn, ChildProcessWithoutNullStreams } = require('child_process');
const config = require('../config/app.config');

/**
 * Класс, инкапсулирующий логику запуска Gemini CLI.
 */
class GeminiService {

    constructor() {
        this.cliCommand = config.gemini.CLI_COMMAND;
        this.maxConcurrent = config.gemini.MAX_CONCURRENT_REQUESTS;
        this.activeRequests = 0;
        this.requestQueue = [];
    }

    _buildArgs(messages, model, stream = false) {
        let fullPrompt = '';

        if (Array.isArray(messages)) {
            fullPrompt = messages.map(msg => {
                let prefix = 'User';
                if (msg.role === 'system') prefix = 'System Instruction';
                else if (msg.role === 'assistant') prefix = 'Model';
                else if (msg.role === 'user') prefix = 'User';
                return `${prefix}: ${msg.content}`;
            }).join('\n\n');
        } else {
            // Legacy/Fallback input
            fullPrompt = String(messages);
        }

        const args = [fullPrompt, '-m', model];
        if (stream) {
            args.push('-o', 'stream-json');
        }
        return args;
    }

    checkHealth() {
        return spawn(this.cliCommand, ['--version']);
    }

    /**
     * Создает процесс генерации, соблюдая лимит одновременных запросов.
     * Возвращает Promise, который резолвится в ChildProcess, когда подойдет очередь.
     */
    async createProcessBuffered(messages, model, isStream) {
        // Если слотов нет — ждем в очереди
        if (this.activeRequests >= this.maxConcurrent) {
            console.log(`[Queue] Limit reached (${this.activeRequests}/${this.maxConcurrent}). Request queued.`);
            await new Promise(resolve => this.requestQueue.push(resolve));
        }

        this.activeRequests++;
        const args = this._buildArgs(messages, model, isStream);
        const child = spawn(this.cliCommand, args);

        const onFinish = () => {
            this.activeRequests--;
            console.log(`[Queue] Process finished. Active: ${this.activeRequests}/${this.maxConcurrent}`);
            if (this.requestQueue.length > 0) {
                // Запускаем следующий ждущий запрос
                const nextResolve = this.requestQueue.shift();
                nextResolve();
            }
        };

        // Освобождаем слот при любом исходе
        child.on('close', onFinish);
        child.on('error', (err) => {
            // Если ошибка запуска (до close), тоже надо освободить слот, 
            // но обычно error сопровождается close или exit, однако для надежности:
            // (хотя часто close стреляет всегда, дублировать не будем, оставим на close)
        });

        return child;
    }
}

// Экспортируем единственный экземпляр (Singleton pattern)
module.exports = new GeminiService();