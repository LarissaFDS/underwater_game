# Frontend Architecture

## Runtime

The frontend lives in `client` and uses Vite, Phaser, TypeScript, and `socket.io-client`. It builds to `dist`, which is the directory published by the Render Static Site.

The current deployment direction keeps both the frontend and the backend services on Render. The browser talks directly to the public Render services. The gameplay socket uses `VITE_SOCKET_URL`; the code must not hardcode the Render URL.

## Render deployment

Keep the frontend as a Render Static Site:

```text
Service Type: Static Site
Root Directory: client
Build Command: npm install && npm run build
Publish Directory: dist
```

Set the backend URL before building the frontend:

```text
VITE_SOCKET_URL=https://URL-DO-BACKEND-RENDER
```

For local development, use:

```text
VITE_SOCKET_URL=http://localhost:3001
```

The current login and final score flows also use the existing `VITE_AUTH_URL` and `VITE_SCORE_URL` variables when those services are not running on their local fallback ports.

## Render warmup flow

Render services can have a cold start after a period without traffic. To avoid opening Socket.IO while the `game-service` is still waking up, `WarmupScene` is the first Phaser scene. Before login and before any gameplay Socket.IO connection, it calls:

```text
${VITE_SOCKET_URL}/health
```

While the backend is cold or unavailable, the user sees:

```text
Inicializando o sistema...
Aquecendo servidor no Render...
Isso pode levar alguns segundos no primeiro acesso.
```

The scene retries automatically every 2.5 seconds, up to 20 attempts. A successful HTTP 200 starts `NicknameScene`; after login, `MenuScene` calls `socketManager.connect()` and Socket.IO connects normally. If the health check never succeeds, the scene shows an error and a retry button instead of leaving a blank screen.

This does not change Socket.IO event names, room behavior, player ids, seeds, map generation, or synchronization logic.

## Files changed

- `client/src/scenes/WarmupScene.ts`: startup screen, health check, retry limit, retry button.
- `client/src/config/gameService.ts`: shared resolver for `VITE_SOCKET_URL` and local fallback.
- `client/src/main.ts`: starts Phaser with `WarmupScene` first.
- `client/src/socket/SocketManager.ts`: reuses the shared game-service URL resolver before creating Socket.IO.
- `game-service/src/server/GameServer.ts`: exposes `GET /health`.
- `client/.env.example`: documents local and Render examples without a fixed real URL.

## Local testing

From `client`:

```bash
npm install
npm run build
```

To test the warmup locally, start the backend services and then run the frontend with `VITE_SOCKET_URL=http://localhost:3001`. With the game backend stopped, the frontend should stay on the initialization/retry screen and eventually show the retry option. With an invalid `VITE_SOCKET_URL`, it should show the same error path after the retry limit.

When the game backend is running and `/health` responds with HTTP 200, the frontend should advance past `WarmupScene`, allow login, and connect Socket.IO from `MenuScene` normally.
