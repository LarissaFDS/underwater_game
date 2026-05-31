# Deploy no Render

## Backend

O `game-service` Socket.IO deve estar publicado em uma URL publica HTTPS:

```text
https://<game-service>.onrender.com
```

O `score-service` Socket.IO tambem precisa estar publicado em uma URL publica HTTPS para que a `EndScene` receba `game:result`:

```text
https://<score-service>.onrender.com
```

Configure o CORS dos dois servicos para aceitar o frontend publico:

```text
CORS_ORIGIN=https://<frontend>.onrender.com
```

O `score-service` tambem precisa se conectar ao `game-service` pelo `GAME_SERVICE_URL`:

```text
GAME_SERVICE_URL=https://<game-service>.onrender.com
```

Como o `game-service` guarda a sala em memoria, mantenha uma unica instancia/replica no Render. Para multiplas instancias, sera necessario usar adapter compartilhado do Socket.IO e estado de matchmaking compartilhado.

## Frontend

Crie o frontend como um Static Site no Render:

```text
Service Type: Static Site
Root Directory: client
Build Command: npm install && npm run build
Publish Directory: dist
```

Configure as variaveis de ambiente antes do build:

```text
VITE_SOCKET_URL=https://<game-service>.onrender.com
VITE_SCORE_URL=https://<score-service>.onrender.com
```

Depois do deploy, a URL publica do Static Site sera a URL do jogo em nuvem. Variaveis `VITE_*` sao embutidas pelo Vite no bundle; se mudar `VITE_SOCKET_URL` ou `VITE_SCORE_URL`, faca rebuild/redeploy do frontend.

## Teste local com backend em nuvem

```bash
cd client
npm install
VITE_SOCKET_URL=https://<game-service>.onrender.com VITE_SCORE_URL=https://<score-service>.onrender.com npm run dev
```

## CORS

Se `CORS_ORIGIN`, `CORS_ORIGINS` ou `FRONTEND_ORIGIN` nao forem definidos, os servicos aceitam origens abertas. Em producao, prefira restringir para:

```text
http://localhost:5173
https://URL-PUBLICA-DO-FRONTEND.onrender.com
```

Use lista separada por virgulas quando precisar permitir mais de uma origem.
