# Frontend Architecture

## Runtime

The frontend lives in `client` and uses Vite, Phaser, TypeScript, and `socket.io-client`. It builds to `dist`, which is the directory published by the Render Static Site.

The current deployment direction keeps both the frontend and the backend services on Render. The browser talks directly to the public Render services. The gameplay socket uses `VITE_SOCKET_URL`; login uses `VITE_AUTH_URL`; final score updates use `VITE_SCORE_URL`. The warmup also checks the `puzzle-api` through `VITE_PUZZLE_API_URL` because `game-service` depends on it during puzzle flow. The code must not hardcode Render URLs.

## Render deployment

Keep the frontend as a Render Static Site:

```text
Service Type: Static Site
Root Directory: client
Build Command: npm install && npm run build
Publish Directory: dist
```

Set the backend URLs before building the frontend:

```text
VITE_SOCKET_URL=https://URL-DO-GAME-SERVICE-RENDER
VITE_AUTH_URL=https://URL-DO-AUTH-SERVICE-RENDER
VITE_SCORE_URL=https://URL-DO-SCORE-SERVICE-RENDER
VITE_PUZZLE_API_URL=https://URL-DA-PUZZLE-API-RENDER
```

For local development, use:

```text
VITE_SOCKET_URL=http://localhost:3001
VITE_AUTH_URL=http://localhost:3004
VITE_SCORE_URL=http://localhost:3003
VITE_PUZZLE_API_URL=http://localhost:3002
```

When a URL is not set during local development, the shared frontend config falls back to the matching localhost port. `VITE_API_URL` is still accepted as a legacy fallback for the puzzle API, but new environments should use `VITE_PUZZLE_API_URL`. In a deployed HTTPS frontend, the variables must point to the public HTTPS URLs of the services.

## Render warmup flow

Render services can have a cold start after a period without traffic. To avoid opening login or Socket.IO connections while the backend services are still waking up, `WarmupScene` is the first Phaser scene. Before login and before any gameplay Socket.IO connection, it calls `GET /health` for every service configured in `client/src/config/services.ts`:

```text
${VITE_SOCKET_URL}/health
${VITE_AUTH_URL}/health
${VITE_SCORE_URL}/health
${VITE_PUZZLE_API_URL}/health
```

Each service must expose `GET /health` and return HTTP 200 when ready. The `puzzle-api` is not called directly by the frontend during gameplay, but `game-service` calls it for catalog, hints, and guess validation. Warming it before the match prevents the first puzzle from failing while Render wakes that service. While a service is cold or unavailable, the user sees which service is being initialized:

```text
Inicializando o sistema...
Aquecendo API de puzzles...
Isso pode levar alguns segundos no primeiro acesso.
```

The scene retries each service automatically every 2.5 seconds, up to 20 attempts. Only after all configured services return HTTP 200 does it start `NicknameScene`; after login, `MenuScene` calls `socketManager.connect()` and Socket.IO connects normally. If any health check never succeeds, the scene shows which service failed and a retry button instead of leaving a blank screen.

This flow handles Render cold starts without changing Socket.IO events, replacing Socket.IO with an API Gateway, or moving service restart controls into the browser.

This does not change Socket.IO event names, room behavior, player ids, seeds, map generation, or synchronization logic.

## Relevant files

- `client/src/scenes/WarmupScene.ts`: startup screen, health check, retry limit, retry button.
- `client/src/config/services.ts`: shared resolvers for `VITE_SOCKET_URL`, `VITE_AUTH_URL`, `VITE_SCORE_URL`, `VITE_PUZZLE_API_URL`, local fallbacks, and the warmup service list.
- `client/src/main.ts`: starts Phaser with `WarmupScene` first.
- `client/src/socket/SocketManager.ts`: reuses the shared game-service URL resolver before creating Socket.IO.
- `client/src/socket/ScoreSocketManager.ts`: reuses the shared score-service URL resolver before creating Socket.IO.
- `client/src/scenes/NicknameScene.ts`: reuses the shared auth-service URL resolver before login.
- `game-service/src/server/GameServer.ts`: exposes `GET /health`.
- `auth-service/src/server/AuthServer.ts`: exposes `GET /health`.
- `score-service/src/server/ScoreServer.ts`: exposes `GET /health`.
- `puzzle-api/src/app.ts`: exposes `GET /health` for the existing backend microservice, even though it is called by `game-service` rather than directly by the frontend.
- `client/.env.example`: documents local and Render examples without a fixed real URL.

## Manual restart

Manual restart through the Render API must not be triggered from the public frontend and the Render API key must never be bundled into Vite code. A future implementation could add a protected backend administrative endpoint, such as `POST /admin/restart-services`, that verifies admin authorization server-side and then calls the Render API. That endpoint is intentionally outside the current warmup flow.

## Local testing

From `client`:

```bash
npm install
npm run build
```

To test the warmup locally, start the backend services and then run the frontend with `VITE_SOCKET_URL=http://localhost:3001`, `VITE_AUTH_URL=http://localhost:3004`, `VITE_SCORE_URL=http://localhost:3003`, and `VITE_PUZZLE_API_URL=http://localhost:3002`. With any configured service stopped, the frontend should stay on the initialization/retry screen for that service and eventually show the retry option. With an invalid service URL, it should show the same error path after the retry limit.

When all configured services respond to `/health` with HTTP 200, the frontend should advance past `WarmupScene`, allow login, and connect Socket.IO from `MenuScene` normally.
