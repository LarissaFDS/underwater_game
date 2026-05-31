"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRouter = void 0;
const express_1 = require("express");
const buildRouter = (controller) => {
    const router = (0, express_1.Router)();
    router.get('/scores', controller.getAll); //lista todos os resultados
    router.get('/scores/latest', controller.getLatest); //resultado mais recente
    router.get('/scores/:id', controller.getById); //resultado por id
    return router;
};
exports.buildRouter = buildRouter;
