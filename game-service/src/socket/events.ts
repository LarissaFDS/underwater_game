export enum SocketEvents {
  PLAYER_JOIN = 'player:join',
  PLAYER_DISCONNECT = 'player:disconnect',
  PLAYER_MOVE = 'player:move',
  PLAYER_MOVED = 'player:moved',
  GAME_START = 'game:start',
  ROOM_FULL = 'room:full',
  ANIMAL_APPROACH = 'animal:approach',
  PUZZLE_START = 'puzzle:start',
  PUZZLE_END = 'puzzle:end',
  PLAYER_HIT = 'player:hit',
  PUZZLE_GUESS = 'puzzle:guess',
  PUZZLE_HINT = 'puzzle:hint',
  PUZZLE_RESULT = 'puzzle:result',
  PLAYER_GAMEOVER = 'player:gameover',
  GAME_OVER = 'game:over',
  STATE_UPDATE = 'state:update'
}