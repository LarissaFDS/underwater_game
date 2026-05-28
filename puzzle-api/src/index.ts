import { App } from './app';

const PORT = Number(process.env.PORT) || 3002;

const app = new App();
app.listen(PORT);