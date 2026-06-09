# Underwater Game

`underwater_game` é um jogo digital online não violento, multiplayer para 2 jogadores, em que cada participante controla um submarino em um ambiente subaquático. O jogo combina exploração, animais marinhos, puzzles no estilo forca, gerenciamento de oxigênio, vidas, respawn, eliminação, pontuação e uma tela final com resultado da partida.

## Objetivo acadêmico

O projeto foi desenvolvido para a disciplina de Engenharia de Software, com foco em:

- microserviços;
- componentes de software;
- jogo online;
- comunicação em tempo real;
- Docker e deploy.

## Funcionalidades principais

- Login por nickname antes da conexão com a sala.
- Multiplayer online para 2 jogadores.
- Movimentação de submarinos em mapa subaquático.
- Mapa gerado por seed compartilhada entre os jogadores.
- Interação com animais marinhos.
- Puzzles/minigames no estilo forca.
- HUD com oxigênio, vidas/corações e nickname.
- Sistema de respawn e eliminação.
- Pontuação final calculada por serviço próprio.
- Jogar novamente/rematch ao final da partida.
- Efeitos visuais de água no frontend.

## Arquitetura

O repositório é um monorepo com frontend, quatro microserviços backend e tipos compartilhados.

### `client`

Frontend em Vite + Phaser + TypeScript. Renderiza as cenas do jogo, captura ações do jogador, mantém o HUD e se comunica com os serviços backend por HTTP e Socket.IO.

Componentes importantes:

- `NicknameScene`: tela de login por nickname.
- `MenuScene`: entrada da sala e espera pelo segundo jogador.
- `GameScene`: cena principal do jogo.
- `PuzzleScene`: minigame de forca.
- `EndScene`: resultado final e rematch.
- `SocketManager`: Socket.IO com o `game-service`.
- `ScoreSocketManager`: Socket.IO com o `score-service`.
- `MovementSystem`, `MapGenerationSystem` e `WaterEffectsSystem`: sistemas de movimento, mapa e efeitos visuais.

### `auth-service`

Microsserviço REST em Node.js + Express + TypeScript. Faz login por nickname, valida formato do apelido e gera token temporário em memória. O `game-service` consulta esse serviço para validar o token enviado pelo frontend no handshake Socket.IO.

Rotas principais:

- `POST /api/login`
- `GET /api/validate/:token`
- `GET /health`

### `game-service`

Serviço principal da partida, em Node.js + Express + Socket.IO + TypeScript. Mantém a sala multiplayer, estado dos jogadores, oxigênio, vidas, puzzles ativos, seed do mapa, game over e restart.

Eventos principais:

- `room:joined`
- `room:full`
- `game:start`
- `player:move`
- `player:moved`
- `animal:approach`
- `puzzle:start`
- `puzzle:guess`
- `puzzle:hint`
- `puzzle:result`
- `puzzle:end`
- `player:hit`
- `state:update`
- `player:gameover`
- `game:over`
- `game:restart`
- `partner:disconnected`

### `puzzle-api`

API REST em Node.js + Express + TypeScript para catálogo de animais, dicas e validação do puzzle.

Rotas principais:

- `GET /api/animals`
- `POST /api/puzzle/guess`
- `POST /api/puzzle/hint`

Animais cadastrados no código atual:

- peixe-palhaço;
- tartaruga;
- polvo;
- tubarão-martelo;
- arraia.

### `score-service`

Microsserviço de pontuação em Node.js + Express + Socket.IO + TypeScript. Conecta-se ao `game-service`, recebe `game:over`, calcula o resultado final e emite `game:result` para o frontend.

Rotas principais:

- `GET /api/scores`
- `GET /api/scores/latest`
- `GET /api/scores/:id`
- `GET /health`

## Comunicação entre serviços

O projeto não usa API Gateway dedicado na versão atual. A comunicação principal do jogo é via Socket.IO, porque o gameplay exige atualização em tempo real.

- O frontend usa HTTP para login no `auth-service`.
- O frontend usa Socket.IO com o `game-service` para gameplay.
- O frontend usa Socket.IO com o `score-service` para receber o resultado final.
- O `game-service` consulta o `auth-service` por HTTP para validar token.
- O `game-service` consulta a `puzzle-api` por HTTP para catálogo, dicas e validação de letras.
- O `score-service` conecta ao `game-service` por Socket.IO para receber `game:over`.

```text
Client
  -> HTTP      -> auth-service
  -> Socket.IO -> game-service
  -> Socket.IO -> score-service

game-service -> HTTP      -> auth-service
game-service -> HTTP      -> puzzle-api
score-service <-> Socket.IO -> game-service
```

## Como rodar o projeto localmente

### Opção recomendada: Docker Compose

A forma mais simples de executar o projeto completo é usando Docker Compose, pois ele sobe o frontend e todos os microserviços necessários.

Clone o repositório:

```bash
git clone https://github.com/LarissaFDS/underwater_game.git
cd underwater_game
```

Suba os containers:

```bash
docker compose up --build
```

Após a inicialização, acesse o frontend no navegador:

```text
http://localhost:5173
```

Para testar a partida multiplayer, abra o jogo em dois navegadores, duas abas diferentes ou em duas máquinas na mesma rede. Cada jogador deve informar um nickname. A partida só inicia quando dois jogadores entram na sala.

Serviços locais definidos no `docker-compose.yml`:

| Serviço | URL local | Porta |
| --- | --- | --- |
| Frontend | `http://localhost:5173` | `5173` |
| Game Service | `http://localhost:3001` | `3001` |
| Puzzle API | `http://localhost:3002` | `3002` |
| Score Service | `http://localhost:3003` | `3003` |
| Auth Service | `http://localhost:3004` | `3004` |

Para parar os containers:

```bash
docker compose down
```

Para recriar tudo do zero, incluindo volumes anônimos:

```bash
docker compose down --remove-orphans -v
docker compose up --build --force-recreate
```

Variáveis usadas pelo Compose em desenvolvimento:

- `VITE_SOCKET_URL=http://localhost:3001`
- `VITE_SCORE_URL=http://localhost:3003`
- `VITE_API_URL=http://localhost:3002`
- `VITE_AUTH_URL=http://localhost:3004`
- `PUZZLE_API_URL=http://puzzle-api:3002`
- `AUTH_SERVICE_URL=http://auth-service:3004`
- `GAME_SERVICE_URL=http://game-service:3001`

### Rodando sem Docker

Também é possível rodar cada serviço manualmente, em terminais separados. Nesse caso, a ordem recomendada é:

1. `auth-service`
2. `puzzle-api`
3. `game-service`
4. `score-service`
5. `client`

Auth Service:

```bash
cd auth-service
npm install
npm run dev
```

Puzzle API:

```bash
cd puzzle-api
npm install
npm run dev
```

Game Service:

```bash
cd game-service
npm install
npm run dev
```

Score Service:

```bash
cd score-service
npm install
npm run dev
```

Frontend:

```bash
cd client
npm install
npm run dev
```

No modo sem Docker, verifique se o frontend possui as variáveis locais corretas:

```text
VITE_AUTH_URL=http://localhost:3004
VITE_SOCKET_URL=http://localhost:3001
VITE_SCORE_URL=http://localhost:3003
```

As variáveis `VITE_*` precisam estar configuradas antes do build do frontend.

Para gerar builds de produção sem Docker, execute `npm run build` dentro de cada serviço. Nos microserviços backend, o build pode ser iniciado com `npm start` depois da compilação.

Backend:

```bash
npm run build
npm start
```

Frontend:

```bash
npm run build
```

## Variáveis de ambiente

O projeto utiliza variáveis de ambiente para configurar a comunicação entre o frontend e os microserviços.

No frontend, as variáveis principais são:

```env
VITE_AUTH_URL=http://localhost:3004
VITE_SOCKET_URL=http://localhost:3001
VITE_SCORE_URL=http://localhost:3003
```

Essas variáveis indicam onde estão o `auth-service`, o `game-service` e o `score-service`.

Em produção, os valores devem ser substituídos pelas URLs públicas HTTPS dos serviços hospedados na nuvem:

```env
VITE_AUTH_URL=https://seu-auth-service.exemplo.com
VITE_SOCKET_URL=https://seu-game-service.exemplo.com
VITE_SCORE_URL=https://seu-score-service.exemplo.com
```

Como o frontend utiliza Vite, qualquer variável iniciada com `VITE_` precisa estar configurada antes do build. Se uma dessas URLs for alterada na plataforma de deploy, será necessário executar um novo build/deploy do frontend.

Nos microserviços backend, as principais variáveis são as URLs usadas para comunicação entre serviços, como `AUTH_SERVICE_URL`, `PUZZLE_API_URL` e `GAME_SERVICE_URL`. No Docker Compose, essas URLs normalmente apontam para os nomes dos serviços. Em nuvem, devem apontar para as URLs públicas ou privadas configuradas na plataforma escolhida.

## Deploy em nuvem

O projeto pode ser publicado em plataformas como Render, Railway, Fly.io ou outras que suportem aplicações Node.js e frontend estático.

A recomendação é criar um serviço separado para cada parte do sistema:

- `client`: frontend estático gerado pelo Vite;
- `auth-service`: web service Node.js;
- `game-service`: web service Node.js com Socket.IO;
- `puzzle-api`: web service Node.js;
- `score-service`: web service Node.js com Socket.IO.

### Frontend

No serviço do frontend, configure:

- diretório raiz: `client`;
- comando de build: `npm install && npm run build`;
- diretório de publicação: `dist`.

As variáveis `VITE_AUTH_URL`, `VITE_SOCKET_URL` e `VITE_SCORE_URL` devem apontar para as URLs públicas dos respectivos microserviços.

### Microserviços

Cada microserviço deve ser criado como um serviço Node.js separado. Em geral, a configuração segue o padrão:

- comando de build: `npm install && npm run build`;
- comando de start: `npm start`;
- variável `PORT` definida pela plataforma ou configurada manualmente.

Também é necessário configurar as URLs entre serviços. Por exemplo:

```env
AUTH_SERVICE_URL=https://seu-auth-service.exemplo.com
PUZZLE_API_URL=https://seu-puzzle-api.exemplo.com
GAME_SERVICE_URL=https://seu-game-service.exemplo.com
```

Os serviços que recebem chamadas do navegador precisam permitir a origem do frontend via CORS.

### Observações importantes

- O `game-service` mantém o estado da sala em memória. Por isso, em produção, recomenda-se usar apenas uma instância/replica desse serviço.
- O Socket.IO deve estar habilitado na plataforma de deploy, com suporte a polling e websocket.
- Sempre que as variáveis `VITE_*` forem alteradas, o frontend precisa ser buildado novamente.
- O frontend permanece publicado no Render; se variáveis `VITE_*` mudarem, refaça o build/redeploy do Static Site.

## Fluxo do jogo

1. O jogador informa um nickname.
2. O `auth-service` valida o nickname e retorna token temporário.
3. O frontend armazena o token; antes do Socket.IO, a `WarmupScene` garante que o `game-service` respondeu em `/health`.
4. Os jogadores aguardam a formação da sala.
5. Quando há 2 jogadores, o `game-service` emite `game:start`.
6. O frontend inicia a `GameScene` com a seed recebida.
7. Os jogadores exploram o mapa com seus submarinos.
8. Ao se aproximar dos animais, o frontend emite `animal:approach`.
9. O `game-service` consulta a `puzzle-api` e abre o puzzle quando aplicável.
10. O estado de jogadores, O2, vidas e progresso é sincronizado por Socket.IO.
11. A partida termina por exploração ou eliminação.
12. O `score-service` recebe `game:over`, calcula a pontuação e emite `game:result`.
13. A `EndScene` mostra vencedor, motivo, pontuação e opção de jogar novamente.

## Scripts úteis

### `client`

| Script | Comando | Descrição |
| --- | --- | --- |
| `dev` | `npm run dev` | Inicia o Vite em desenvolvimento. |
| `build` | `npm run build` | Executa TypeScript e build Vite. |

### `auth-service`, `game-service`, `puzzle-api` e `score-service`

| Script | Comando | Descrição |
| --- | --- | --- |
| `dev` | `npm run dev` | Inicia o serviço com `ts-node-dev`. |
| `build` | `npm run build` | Compila TypeScript para `build/`. |
| `start` | `npm start` | Executa `node build/index.js`. |

## Estrutura de pastas
```text
underwater_game/
├── auth-service/          # Microsserviço de autenticação (TypeScript)
│   ├── src/
│   │   ├── controllers/   # AuthController
│   │   ├── services/      # AuthService
│   │   ├── repositories/  # TokenRepository (in-memory, TTL 20min)
│   │   ├── dtos/          # AuthDTO
│   │   └── server/        # AuthServer (Express)
│   └── package.json
├── game-service/          # Microsserviço principal de jogo (TypeScript)
│   ├── src/
│   │   ├── game/          # GameRoom
│   │   ├── models/        # PlayerState, AnimalState
│   │   ├── socket/        # events.ts
│   │   ├── dtos/          # ScoreDTO
│   │   └── server/        # GameServer (Socket.IO)
│   └── package.json
├── puzzle-api/            # API REST de puzzles (TypeScript)
│   ├── src/
│   │   ├── controllers/   # PuzzleController
│   │   ├── services/      # PuzzleService
│   │   ├── repositories/  # AnimalRepository
│   │   ├── data/          # animals.ts (catálogo)
│   │   └── app.ts
│   └── package.json
├── score-service/         # Microsserviço de pontuação (TypeScript)
│   ├── src/
│   │   ├── controllers/   # ScoreController
│   │   ├── services/      # ScoreService, ScoreCalculator
│   │   ├── repositories/  # GameResultRepository
│   │   ├── socket/        # GameBridge (WS cliente)
│   │   └── server/        # ScoreServer
│   └── package.json
├── client/                # Frontend Phaser + Vite (TypeScript)
│   ├── src/
│   │   ├── scenes/        # NicknameScene, MenuScene, GameScene, PuzzleScene, EndScene
│   │   ├── entities/      # PlayerSubmarine, Animal
│   │   ├── systems/       # MovementSystem, MapGenerationSystem, WaterEffectsSystem
│   │   ├── socket/        # SocketManager, ScoreSocketManager
│   │   ├── ui/            # HUD
│   │   └── assets/        # PNG sprites + assetsMap.ts
│   └── package.json
├── docs/                  # Documentação complementar
│   ├── DEPLOY.md          # Instruções detalhadas de deploy no Render
│   ├── FRONTEND_ARCHITECTURE.md
│   └── relatorio.pdf
├── docker-compose.yml     # Orquestração local de 5 containers
└── shared/                # Tipos compartilhados entre serviços
    └── types/             # Player, GameState, Animal
```
## Status do projeto

O projeto está funcional e contém fluxo completo de login, sala multiplayer para 2 jogadores, gameplay, puzzles, pontuação final e rematch. Alguns pontos ainda podem evoluir.

Melhorias futuras:

- correção completa de fluxo de desconexão/reentrada;
- persistência em banco de dados;
- múltiplas salas simultâneas;
- ranking/histórico de partidas;
- API Gateway opcional.

## Créditos/equipe

```text
Equipe: Larissa Ferreira, Otávio Menezes
Disciplina: Engenharia de Software
Professor: Arturo Hernandes Dominguez
```
