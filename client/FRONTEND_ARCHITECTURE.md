# Arquitetura do Frontend — underwater_game

## 1. Visão geral

O frontend é o serviço de interface do jogo `underwater_game`. Ele é responsável por renderizar as cenas em Phaser, capturar ações do jogador local e apresentar o estado visual da partida.

Ele roda separado do backend e se comunica com ele via Socket.IO. O frontend não deve ser a fonte final das regras de estado: O2, vidas, respawn, game over e estado dos jogadores devem ser confirmados pelo backend e enviados ao cliente por eventos.

## 2. Componentes de software do frontend

- `SocketManager`: componente central de comunicação com o `game-service`. Encapsula Socket.IO, tipa os eventos de gameplay e mantém o último `state:update` recebido.
- `ScoreSocketManager`: componente de integração com o `score-service`. Escuta `game:result`, que entrega ao frontend o resultado final calculado pelo backend.
- `MenuScene`: componente de entrada e matchmaking visual. Exibe a espera pelo segundo jogador e inicia a partida quando recebe `game:start`.
- `GameScene`: componente principal do jogo. Cria mapa, submarinos, câmera, HUDs, animais e integra eventos de multiplayer. Ela apenas congela/transiciona o fim da partida; não calcula pontuação.
- `PuzzleScene`: componente do minigame da forca. Recebe os dados do animal e envia letras/dicas ao backend.
- `EndScene`: componente visual de resultado final. Mostra vencedor, motivo, animais descobertos, pontuação por animal, resumo por jogador e botão "Jogar novamente".
- `HUD`: componente de interface para O2 e vidas. A `GameScene` usa uma HUD local e outra para o parceiro.
- `PlayerSubmarine`: componente/entidade visual do jogador. Representa tanto o submarino local quanto o parceiro remoto.
- `Animal`: componente/entidade de interação. Possui raio de detecção usado para emitir aproximação.
- `MovementSystem`: componente de lógica de movimento local. Mantém velocidade, direção visual e cálculo por delta fora da `GameScene`.
- `MapGenerationSystem`: componente de geração do mapa. Usa seed para criar grade, obstáculos e decorações.

## 3. Assets de sprites (issue #13)

### Onde os assets ficam

Todos os PNGs de sprite estão em `client/src/assets/`:

```
client/src/assets/
├── submarines/
│   └── submarine.png
├── animals/
│   ├── peixe-palhaco.png
│   ├── tartaruga.png
│   ├── polvo.png
│   ├── tubarao-martelo.png
│   └── arraia.png
└── ui/
    ├── heart.png
    └── o2-bubble.png
```

### Quem faz o preload

`GameScene.preload()` é responsável por carregar todos os sprites. Cada PNG é importado no topo do arquivo usando **import estático compatível com Vite**:

```ts
import submarineUrl from "../assets/submarines/submarine.png";
```

O Vite resolve cada import para uma URL com hash de conteúdo em tempo de build. Essas URLs são passadas para `this.load.image(key, url)` dentro de `preload()`. Nunca use strings de caminho raw (e.g. `"../assets/submarine.png"`) diretamente em `this.load.image()`, pois o caminho seria quebrado em produção.

### Chaves de textura registradas em `preload()`

| Chave | Arquivo |
|---|---|
| `"submarine"` | `submarines/submarine.png` |
| `"animal-peixe-palhaco"` | `animals/peixe-palhaco.png` |
| `"animal-tartaruga"` | `animals/tartaruga.png` |
| `"animal-polvo"` | `animals/polvo.png` |
| `"animal-tubarao-martelo"` | `animals/tubarao-martelo.png` |
| `"animal-arraia"` | `animals/arraia.png` |
| `"ui-heart"` | `ui/heart.png` |
| `"ui-o2-bubble"` | `ui/o2-bubble.png` |

### Como as entidades consomem as texturas

**PlayerSubmarine** (`src/entities/PlayerSubmarine.ts`)
- Continua sendo um `Phaser.GameObjects.Container` (compatibilidade de colisão e câmera preservada).
- Cria internamente um `Phaser.GameObjects.Image` filho com a textura `"submarine"`, dimensionado para `120×48` px.
- O submarino parceiro recebe um tint cinza (`0x9ca3af`) via `options.isPartner`, substituindo o sistema de `SubmarineColors` anterior.
- O idle tween anima **somente o sprite interno** (±3 px no eixo Y, 1200 ms, Sine, yoyo, repeat -1), sem mover o container — o `getBounds()` do container não é afetado pela animação.
- `setDirection()` usa `sprite.setFlipX(direction === "left")` em vez de `setScale(-1, 1)` no container, preservando os bounds de gameplay.

**Animal** (`src/entities/Animal.ts`)
- Continua sendo um `Phaser.GameObjects.Container`.
- O `detectionRadius` é mantido como lógica pura; o círculo de detecção visível foi removido.
- A textura é escolhida por `id` via mapa estático (`TEXTURE_MAP`). Fallback para `"animal-peixe-palhaco"` se o id for desconhecido.
- Sprite dimensionado para `100×100` px para consistência visual entre espécies.
- Animais não descobertos recebem um patrol tween no **container** (+40 px no eixo X, 1600 ms, Sine, yoyo, repeat -1).
- `markDiscovered()` para o patrol tween, aplica `alpha 0.45` e marca `discovered = true`. O animal permanece visível na cena.
- Animais que iniciam com `config.discovered = true` já nascem com `alpha 0.45` e sem patrol tween.
- A propriedade pública `color` foi removida do `AnimalConfig` (não é mais necessária).

**HUD** (`src/ui/HUD.ts`)
- O array `hearts` passou de `Phaser.GameObjects.Arc[]` para `Phaser.GameObjects.Image[]`.
- Cada coração usa a textura `"ui-heart"`, dimensionado para `22×22` px.
- `setHearts(count)`: corações ativos → `alpha 1`, `clearTint()`; corações inativos → `alpha 0.25`, `setTint(0x888888)`.
- Um ícone `"ui-o2-bubble"` (`18×18` px) é posicionado à esquerda da barra de oxigênio como label visual.
- O comportamento da barra de oxigênio (fill tween via `displayWidth`) permanece idêntico ao original.

### Natureza da mudança

Esta alteração é **exclusivamente visual**. Nenhum evento Socket.IO, payload, lógica de movimento, colisão, proximidade de animal, puzzle ou pontuação foi alterado. O contrato backend/frontend permanece intacto.

## 4. Comunicação com backend

| Evento | Direção | Responsabilidade |
| --- | --- | --- |
| `game:start` | Backend -> frontend | Inicia a `GameScene` com seed, jogadores e dados iniciais. |
| `room:full` | Backend -> frontend | Informa que a sala não aceita novos jogadores. |
| `player:move` | Frontend -> backend | Envia a posição do jogador local. |
| `player:moved` | Backend -> frontend | Sincroniza movimento de outro jogador. |
| `player:hit` | Frontend -> backend | Informa colisão local com obstáculo. |
| `state:update` | Backend -> frontend | Snapshot autoritativo de jogadores, O2, vidas e posições. |
| `player:gameover` | Backend -> frontend | Informa perda/respawn de um jogador específico. |
| `game:over` | game-service -> frontend/score-service | Encerra definitivamente a partida. No frontend, congela o jogo; a pontuação final vem depois por `game:result`. |
| `game:result` | score-service -> frontend | Entrega o resultado final calculado pelo `score-service`, incluindo vencedor, motivo e pontuações. |
| `game:restart` | Frontend -> game-service | Solicita nova partida sem recarregar a página. |
| `animal:approach` | Frontend -> backend | Informa que o jogador local entrou no raio de um animal. |
| `puzzle:start` | Backend -> frontend | Abre a `PuzzleScene` com `animalId`, palavra mascarada e primeira dica. |
| `puzzle:end` | Frontend -> backend | Informa fechamento local do puzzle quando aplicável. |
| `puzzle:guess` | Frontend -> backend | Envia uma letra digitada pelo jogador local. |
| `puzzle:hint` | Frontend -> backend | Solicita a próxima dica do animal. |
| `puzzle:result` | Backend -> frontend | Retorna resultado da letra, máscara atualizada, O2 e progresso. |

## 5. Fluxo principal do jogo

O usuário entra pela `MenuScene`, que abre a conexão Socket.IO e aguarda o backend formar a sala. Quando a sala está pronta, o backend emite `game:start` e a `GameScene` inicia com a seed do mapa.

Na `GameScene`, o jogador local move o submarino com base no ponteiro. A posição local é enviada ao backend por `player:move`. O parceiro é sincronizado por eventos recebidos do backend, com suavização visual para evitar saltos.

Quando o jogador local se aproxima de um animal, a cena emite `animal:approach`. O backend decide se deve iniciar o minigame e, quando aplicável, envia `puzzle:start`. A `PuzzleScene` abre, envia letras por `puzzle:guess` e solicita dicas por `puzzle:hint`.

O backend valida acertos, erros, penalidades e progresso. O evento `state:update` mantém HUDs e estado visual sincronizados. Quando um jogador perde O2/vidas, `player:gameover` trata o respawn; quando a partida termina, `game:over` congela o fluxo definitivo e a `GameScene` mostra "Calculando pontuação..." enquanto aguarda o `game:result` do `score-service` para abrir a `EndScene`.

Na `EndScene`, o botão "Jogar novamente" emite `game:restart` pelo `SocketManager`, pois reiniciar a sala é responsabilidade do `game-service`. Quando o `game-service` responde com novo `game:start`, a cena final fecha e a `GameScene` é recriada com a nova seed.

## 6. Separação entre jogador local e parceiro

O jogador local é controlado pelo mouse/teclado e é o único que emite ações locais ao backend. O parceiro é renderizado como uma representação remota, atualizada por eventos de rede.

O id do socket local é usado para diferenciar quais payloads pertencem ao jogador local e quais pertencem ao parceiro. O estado recebido atualiza a HUD local e a HUD do parceiro separadamente.

O2, corações, tentativas e penalidades devem ser tratados por jogador. O frontend pode exibir feedback imediato, mas a confirmação final deve vir dos eventos autoritativos do backend.

## 7. Resultado final e score-service

O `score-service` é o microsserviço responsável pela pontuação final da partida. Ele escuta o fim definitivo (`game:over`), calcula o resultado de forma centralizada e emite `game:result` para os clientes conectados ao `ScoreSocketManager`.

A `EndScene` apenas apresenta o payload recebido. Ela não recalcula vencedor, bônus, penalidades ou totais; isso garante que os dois clientes mostrem a mesma pontuação enviada pelo backend. Campos ausentes no payload devem receber fallback visual seguro para não quebrar a tela.

Em produção, a `EndScene` depende do `game:result` vindo do Socket.IO público do `score-service`. O serviço precisa expor o path padrão `/socket.io` na URL pública configurada em `VITE_SCORE_URL`, com CORS permitindo a origem do frontend. Se o `score-service` demorar ou estiver indisponível, o frontend abre uma tela final com mensagem controlada e sem recalcular pontuação localmente.

O `ScoreSocketManager` mantém polling e websocket habilitados para compatibilidade com o Render; polling inicia a conexão e o Socket.IO pode fazer upgrade para websocket quando disponível.

## 8. Relação com microserviços

O frontend é o serviço de interface do sistema. Atualmente ele usa dois canais Socket.IO: `SocketManager` para o `game-service` (movimento, puzzle, estado, respawn e restart) e `ScoreSocketManager` para o `score-service` (resultado final e pontuação).

O `SocketManager` envia um `clientInstanceId` por aba do navegador para o `game-service`. Esse identificador evita que reconexões ou duplicações acidentais do mesmo ciclo de vida do frontend sejam contadas como dois jogadores reais, sem impedir que uma segunda aba real entre como o segundo jogador.

A `MenuScene` é a entrada obrigatória do fluxo: ela conecta o `SocketManager`, permanece na tela de espera e só inicia a `GameScene` depois de receber `game:start` com dois jogadores reais. A `GameScene` não deve ser aberta diretamente como fallback de desenvolvimento.

Os microserviços internos do backend podem mudar sem afetar diretamente a maior parte do frontend. A dependência principal do cliente é o contrato de eventos Socket.IO: nomes de eventos, direções e formatos de payload.

Se a arquitetura backend mudar, normalmente o frontend só precisa ajustar URL, porta, nomes de eventos ou payloads no `SocketManager`, no `ScoreSocketManager` e nos pontos que consomem esses tipos.

## 9. Deploy

Em produção, o navegador do usuário só consegue acessar URLs públicas. Por isso, `VITE_SOCKET_URL` deve apontar para a URL pública HTTPS do `game-service` no Render, e `VITE_SCORE_URL` deve apontar para a URL pública HTTPS do `score-service` no Render.

Exemplo:

```text
VITE_SOCKET_URL=https://<game-service>.onrender.com
VITE_SCORE_URL=https://<score-service>.onrender.com
```

Os fallbacks locais (`http://localhost:3001` e `http://localhost:3003`, ou o hostname local equivalente) servem apenas para desenvolvimento local/Docker. Em um frontend HTTPS deployado, essas variáveis precisam existir antes do build, porque o Vite embute variáveis `VITE_*` no bundle. Ao alterar `VITE_SOCKET_URL` ou `VITE_SCORE_URL` no Render, faça rebuild/redeploy do frontend.

No código Vite, essas variáveis devem ser lidas com acesso direto: `import.meta.env.VITE_SOCKET_URL` e `import.meta.env.VITE_SCORE_URL`. Evite casts genéricos, `process.env` ou acesso dinâmico por string, porque isso pode impedir a substituição correta durante o build.

O `game-service` mantém o estado da sala em memória. No Render, o serviço deve rodar com uma única instância para que os dois jogadores caiam no mesmo processo. Para múltiplas instâncias, será necessário adicionar um adapter compartilhado do Socket.IO e mover o estado de matchmaking para armazenamento compartilhado.

## 10. Observações para manutenção

- Manter nomes de eventos sincronizados com o backend.
- Evitar duplicar regra de negócio no frontend.
- Manter o backend como fonte de verdade para estado de partida.
- Manter o `score-service` como fonte de verdade para a pontuação final.
- Ao mudar payloads, atualizar os tipos no `SocketManager` ou `ScoreSocketManager`.
- Cuidar de maiúsculas/minúsculas em imports para funcionar corretamente em Linux/Docker.
- Preservar a diferença entre ações locais emitidas pelo cliente e estado remoto recebido do backend.
- Ao adicionar novos assets, sempre importar via `import url from "..."` (compatível com Vite) e registrar em `GameScene.preload()` — nunca usar strings de caminho raw em `this.load.image()`.
