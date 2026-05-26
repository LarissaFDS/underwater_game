import { Router, Request, Response } from 'express';
import { animals } from '../data/animals';

const router = Router();

//Função auxiliar para normalizar letras (remover acentos)
const normalizeLetter = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

//ROTA 1: retorna a lista de animais (sem a propriedade name para não dar spoiler)
router.get('/animals', (req: Request, res: Response) => {
    const sanitizedAnimals = animals.map(({ name, ...rest }) => {
      //Transforma "Peixe-Palhaço" em ["_", "_", "_", "_", "_", "-", "_", ... ]
      const hiddenName = name.split('').map(char => (char === '-' || char === ' ' ? char : '_'));
      return { ...rest, hiddenName };
    });
    res.json(sanitizedAnimals);
  });
  
//ROTA 2: valida o chute de uma letra no puzzle
router.post('/puzzle/guess', (req: Request, res: Response): any => {
  const { animalId, letter } = req.body;
  
  if (!animalId || !letter || letter.length !== 1) {
    return res.status(400).json({ error: 'Campos animalId e letter são obrigatórios.' });
  }

  const animal = animals.find(a => a.id === animalId);
  if (!animal) return res.status(404).json({ error: 'Animal não encontrado.' });

  const positions: number[] = [];
  const nameLower = normalizeLetter(animal.name);
  const letterLower = normalizeLetter(letter);

  for (let i = 0; i < nameLower.length; i++) {
    if (nameLower[i] === letterLower) positions.push(i);
  }

  res.json({ correct: positions.length > 0, positions });
});

//ROTA 3: retorna uma dica baseada no animal e no índice da dica
router.post('/puzzle/hint', (req: Request, res: Response): any => {
  const { animalId, hintIndex } = req.body;

  if (!animalId || typeof hintIndex !== 'number') {
    return res.status(400).json({ error: 'Campos animalId e hintIndex são obrigatórios.' });
  }

  const animal = animals.find(a => a.id === animalId);
  if (!animal) return res.status(404).json({ error: 'Animal não encontrado.' });

  const nextHint = animal.hints[hintIndex];

  if (!nextHint) {
    return res.json({ hint: "Sem mais dicas." });
  }

  res.json({ hint: nextHint });
});

export default router;