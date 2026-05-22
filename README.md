# underwater_game

This is a project for a software engineering course.

### 🗂️ Estrutura do projeto (Monorepo)

```text
/ocean-game 
├── docker-compose.yml       <-- O maestro que roda tudo
├── /client                  <-- Onde o FRONTEND vai trabalhar (Vite + Phaser)
│   ├── package.json
│   └── /src
├── /server                  <-- Onde o BACKEND vai trabalhar (Node + Socket.io)
│   ├── package.json
│   └── /src
└── /shared                  <-- Tipagens que Front e Back vão usar
    └── /types
        ├── Animal.ts
        └── GameState.ts
