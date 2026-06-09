export function getGameServiceUrl(): string {
  const configuredUrl = import.meta.env.VITE_SOCKET_URL?.trim();

  console.log("[gameService] VITE_SOCKET_URL =", configuredUrl || "(not set)");

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  return getLocalFallbackUrl("VITE_SOCKET_URL", "game-service", 3001);
}

function getLocalFallbackUrl(
  envName: string,
  serviceName: string,
  port: number
): string {
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
      `[gameService] ${envName} is required for deployed HTTPS frontends. ` +
      `Set it to the public HTTPS URL of the ${serviceName}.`;
    console.error(message);
    throw new Error(message);
  }

  return `http://${fallbackHost}:${port}`;
}
