export interface WarmupService {
  name: string;
  url: string;
}

interface ServiceConfig {
  envName: "VITE_SOCKET_URL" | "VITE_AUTH_URL" | "VITE_SCORE_URL";
  name: string;
  serviceName: string;
  defaultPort: number;
  logPrefix: string;
}

const serviceConfigs: ServiceConfig[] = [
  {
    envName: "VITE_SOCKET_URL",
    name: "Servidor do jogo",
    serviceName: "game-service",
    defaultPort: 3001,
    logPrefix: "gameService",
  },
  {
    envName: "VITE_AUTH_URL",
    name: "Servico de autenticacao",
    serviceName: "auth-service",
    defaultPort: 3004,
    logPrefix: "authService",
  },
  {
    envName: "VITE_SCORE_URL",
    name: "Servico de pontuacao",
    serviceName: "score-service",
    defaultPort: 3003,
    logPrefix: "scoreService",
  },
];

export function getGameServiceUrl(): string {
  return resolveServiceUrl(serviceConfigs[0]);
}

export function getAuthServiceUrl(): string {
  return resolveServiceUrl(serviceConfigs[1]);
}

export function getScoreServiceUrl(): string {
  return resolveServiceUrl(serviceConfigs[2]);
}

export function getWarmupServices(): WarmupService[] {
  return serviceConfigs
    .map((config) => ({
      name: config.name,
      url: resolveServiceUrl(config),
    }))
    .filter((service) => service.url.length > 0);
}

function resolveServiceUrl(config: ServiceConfig): string {
  const configuredUrl = getConfiguredUrl(config.envName);

  console.log(
    `[${config.logPrefix}] ${config.envName} =`,
    configuredUrl || "(not set)"
  );

  if (configuredUrl) {
    return normalizeUrl(configuredUrl);
  }

  return getLocalFallbackUrl(config);
}

function getConfiguredUrl(envName: ServiceConfig["envName"]): string {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  return env[envName]?.trim() ?? "";
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function getLocalFallbackUrl(config: ServiceConfig): string {
  const fallbackHost =
    typeof window === "undefined" ? "localhost" : window.location.hostname;
  const pageProtocol =
    typeof window === "undefined" ? "http:" : window.location.protocol;
  const isLocalHost = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "[::1]",
  ].includes(fallbackHost);

  if (pageProtocol === "https:" && !isLocalHost) {
    const message =
      `[${config.logPrefix}] ${config.envName} is required for deployed HTTPS frontends. ` +
      `Set it to the public HTTPS URL of the ${config.serviceName}.`;
    console.error(message);
    throw new Error(message);
  }

  return `http://${fallbackHost}:${config.defaultPort}`;
}
