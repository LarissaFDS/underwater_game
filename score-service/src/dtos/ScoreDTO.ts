//Payload recebido do game-service via game:over
export interface GameOverPayload {
    winner: string | null;
    reason: 'elimination' | 'exploration';
    eliminationReason?: 'oxygen' | 'hearts';
    eliminatedPlayerId?: string;
    players: Record<string, RawPlayerState> | RawPlayerState[];
    discoveredAnimals: DiscoveredAnimalRaw[];
  }
  
  export interface RawPlayerState {
    id: string;
    playerId?: string; // <-- Adicione isto
    socketId?: string;
    hearts: number;
    oxygen: number;
    deathCount: number;
  }
  
  export interface DiscoveredAnimalRaw {
    animalId: string;
    discoveredBy: string;       //socket id do jogador que completou
    timeToDiscoverMs: number;   //ms desde puzzle:start até puzzle:end
    elapsedMs?: number;
    timeMs?: number;
    wrongGuesses: number;
    pointsBase: number;
    basePoints?: number;
  }
  
  //Resultado calculado enviado ao cliente via game:result
  
  export interface AnimalScoreEntry {
    animalId: string;
    discoveredBy: string;
    timeToDiscoverMs: number;
    wrongGuesses: number;
    pointsBase: number;
    timeBonus: number;
    wrongPenalty: number;
    totalPoints: number;
  }
  
  export interface PlayerScoreSummary {
    playerId: string;
    totalPoints: number;
    animalsFound: number;
  }
  
  export interface GameResultPayload {
    winner: string | null;
    reason: 'elimination' | 'exploration';
    eliminationReason?: 'oxygen' | 'hearts';
    eliminatedPlayerId?: string;
    animalScores: AnimalScoreEntry[];
    playerSummaries: PlayerScoreSummary[];
  }
