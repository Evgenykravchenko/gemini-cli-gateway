/**
 * @file routes/api.routes.js
 * @description Определение маршрутов (API Endpoints) и привязка их к методам контроллера.
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/chat.controller');

/**
 * @route GET /api/health
 * @description Проверка состояния API.
 */
router.get('/health', (req, res) => controller.healthCheck(req, res));

/**
 * @route GET /api/models
 * @description Получение списка доступных моделей.
 */
router.get('/models', (req, res) => controller.getModels(req, res));

/**
 * @route POST /api/chat
 * @description Основной эндпоинт для чата (ожидание полного ответа).
 */
router.post('/chat', (req, res) => controller.handleStandardChat(req, res));

/**
 * @route POST /api/chat/stream
 * @description Эндпоинт для потокового чата (SSE).
 */
router.post('/chat/stream', (req, res) => controller.handleStreamChat(req, res));

module.exports = router;