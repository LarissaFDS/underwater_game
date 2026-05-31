"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoreController = void 0;
class ScoreController {
    scoreService;
    constructor(scoreService) {
        this.scoreService = scoreService;
    }
    getLatest = (_req, res) => {
        const result = this.scoreService.getLatestResult();
        if (!result) {
            res.status(404).json({ error: 'Nenhum resultado encontrado.' });
            return;
        }
        res.json(result);
    };
    getAll = (_req, res) => {
        res.json(this.scoreService.getAllResults());
    };
    getById = (req, res) => {
        const { id } = req.params;
        const result = this.scoreService.getResultById(id);
        if (!result) {
            res.status(404).json({ error: `Resultado ${id} não encontrado.` });
            return;
        }
        res.json(result);
    };
}
exports.ScoreController = ScoreController;
