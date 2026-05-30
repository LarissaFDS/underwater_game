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

## 3. Comunicação com backend

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

## 4. Fluxo principal do jogo

O usuário entra pela `MenuScene`, que abre a conexão Socket.IO e aguarda o backend formar a sala. Quando a sala está pronta, o backend emite `game:start` e a `GameScene` inicia com a seed do mapa.

Na `GameScene`, o jogador local move o submarino com base no ponteiro. A posição local é enviada ao backend por `player:move`. O parceiro é sincronizado por eventos recebidos do backend, com suavização visual para evitar saltos.

Quando o jogador local se aproxima de um animal, a cena emite `animal:approach`. O backend decide se deve iniciar o minigame e, quando aplicável, envia `puzzle:start`. A `PuzzleScene` abre, envia letras por `puzzle:guess` e solicita dicas por `puzzle:hint`.

O backend valida acertos, erros, penalidades e progresso. O evento `state:update` mantém HUDs e estado visual sincronizados. Quando um jogador perde O2/vidas, `player:gameover` trata o respawn; quando a partida termina, `game:over` congela o fluxo definitivo e a `GameScene` aguarda o `game:result` do `score-service` para abrir a `EndScene`.

Na `EndScene`, o botão "Jogar novamente" emite `game:restart` pelo `SocketManager`, pois reiniciar a sala é responsabilidade do `game-service`. Quando o `game-service` responde com novo `game:start`, a cena final fecha e a `GameScene` é recriada com a nova seed.

## 5. Separação entre jogador local e parceiro

O jogador local é controlado pelo mouse/teclado e é o único que emite ações locais ao backend. O parceiro é renderizado como uma representação remota, atualizada por eventos de rede.

O id do socket local é usado para diferenciar quais payloads pertencem ao jogador local e quais pertencem ao parceiro. O estado recebido atualiza a HUD local e a HUD do parceiro separadamente.

O2, corações, tentativas e penalidades devem ser tratados por jogador. O frontend pode exibir feedback imediato, mas a confirmação final deve vir dos eventos autoritativos do backend.

## 6. Resultado final e score-service

O `score-service` é o microsserviço responsável pela pontuação final da partida. Ele escuta o fim definitivo (`game:over`), calcula o resultado de forma centralizada e emite `game:result` para os clientes conectados ao `ScoreSocketManager`.

A `EndScene` apenas apresenta o payload recebido. Ela não recalcula vencedor, bônus, penalidades ou totais; isso garante que os dois clientes mostrem a mesma pontuação enviada pelo backend. Campos ausentes no payload devem receber fallback visual seguro para não quebrar a tela.

## 7. Relação com microserviços

O frontend é o serviço de interface do sistema. Atualmente ele usa dois canais Socket.IO: `SocketManager` para o `game-service` (movimento, puzzle, estado, respawn e restart) e `ScoreSocketManager` para o `score-service` (resultado final e pontuação).

O `SocketManager` envia um `clientInstanceId` por aba do navegador para o `game-service`. Esse identificador evita que reconexões ou duplicações acidentais do mesmo ciclo de vida do frontend sejam contadas como dois jogadores reais, sem impedir que uma segunda aba real entre como o segundo jogador.

A `MenuScene` é a entrada obrigatória do fluxo: ela conecta o `SocketManager`, permanece na tela de espera e só inicia a `GameScene` depois de receber `game:start` com dois jogadores reais. A `GameScene` não deve ser aberta diretamente como fallback de desenvolvimento.

Os microserviços internos do backend podem mudar sem afetar diretamente a maior parte do frontend. A dependência principal do cliente é o contrato de eventos Socket.IO: nomes de eventos, direções e formatos de payload.

Se a arquitetura backend mudar, normalmente o frontend só precisa ajustar URL, porta, nomes de eventos ou payloads no `SocketManager`, no `ScoreSocketManager` e nos pontos que consomem esses tipos.

## 8. Observações para manutenção

- Manter nomes de eventos sincronizados com o backend.
- Evitar duplicar regra de negócio no frontend.
- Manter o backend como fonte de verdade para estado de partida.
- Manter o `score-service` como fonte de verdade para a pontuação final.
- Ao mudar payloads, atualizar os tipos no `SocketManager` ou `ScoreSocketManager`.
- Cuidar de maiúsculas/minúsculas em imports para funcionar corretamente em Linux/Docker.
- Preservar a diferença entre ações locais emitidas pelo cliente e estado remoto recebido do backend.
