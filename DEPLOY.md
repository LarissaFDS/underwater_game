# Deploy no Render

## Backend

O backend Socket.IO ja esta publicado em:

```text
https://underwater-game-server.onrender.com
```

Ele continua sendo apenas o servidor multiplayer/API usado pelo jogo.

## Frontend

Crie o frontend como um Static Site no Render:

```text
Service Type: Static Site
Root Directory: client
Build Command: npm install && npm run build
Publish Directory: dist
```

Configure a variavel de ambiente:

```text
VITE_SOCKET_URL=https://underwater-game-server.onrender.com
```

Depois do deploy, a URL publica do Static Site sera a URL do jogo em nuvem.

## Teste local com backend em nuvem

```bash
cd client
npm install
npm run build
VITE_SOCKET_URL=https://underwater-game-server.onrender.com npm run dev
```

## CORS

O backend atualmente aceita origens abertas para Express e Socket.IO. Isso e suficiente
para testar o deploy inicial. Depois que a URL publica do frontend existir, o ideal e
restringir o CORS para:

```text
http://localhost:5173
https://URL-PUBLICA-DO-FRONTEND.onrender.com
```
