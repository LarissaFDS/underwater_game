export interface Animal {
  id: string;
  name: string;
  hints: string[];
  points: number;
  rarity: 'common' | 'rare';
}

export const animals: Animal[] = [
  {
    id: 'peixe-palhaco',
    name: 'peixe-palhaço',
    hints: [
      'Vive em uma relação de simbiose com as anêmonas do mar.',
      'Ficou mundialmente famoso no cinema em um filme de animação.',
      'Possui listras verticais brancas brilhantes sobre um corpo laranja.'
    ],
    points: 10,
    rarity: 'common'
  },
  {
    id: 'tartaruga',
    name: 'tartaruga',
    hints: [
      'Possui uma carapaça protetora muito resistente contra predadores.',
      'Realiza longas migrações pelos oceanos retornando à praia onde nasceu para desovar.',
      'É conhecida por sua longevidade, podendo viver por mais de 100 anos.'
    ],
    points: 15,
    rarity: 'common'
  },
  {
    id: 'polvo',
    name: 'polvo',
    hints: [
      'É um invertebrado extremamente inteligente e mestre da camuflagem.',
      'Surpreendentemente, possui três corações e o sangue de cor azul.',
      'Tem o corpo mole e se move usando seus 8 braços cheios de ventosas.'
    ],
    points: 20,
    rarity: 'common'
  },
  {
    id: 'tubarao-martelo',
    name: 'tubarão-martelo',
    hints: [
      'É um predador imponente localizado no topo da cadeia alimentar.',
      'Sua cabeça possui um formato anatômico único e muito peculiar.',
      'A largura de sua cabeça melhora sua visão, dando-lhe um alcance de 360 graus.'
    ],
    points: 40,
    rarity: 'rare'
  },
  {
    id: 'arraia',
    name: 'arraia',
    hints: [
      'Possui um corpo achatado horizontalmente, parecendo um disco ou pipa.',
      'É um peixe cartilaginoso muito próximo na evolução aos tubarões.',
      'Algumas espécies navegam camufladas na areia e possuem um ferrão venenoso na cauda.'
    ],
    points: 35,
    rarity: 'rare'
  }
];