import { ShiprocketClient } from "../modules/shiprocket/client";
import type { IShiprocketClient } from "../modules/shiprocket/client-interface";

let clientInstance: IShiprocketClient | null = null;

export function isShiprocketConfigured(): boolean {
  return Boolean(process.env.SHIPROCKET_EMAIL && process.env.SHIPROCKET_PASSWORD);
}

export function getShiprocketClient(): IShiprocketClient {
  if (clientInstance) return clientInstance;

  const isProd = process.env.NODE_ENV === "production";
  const baseUrl =
    process.env.SHIPROCKET_BASE_URL ||
    (isProd
      ? "https://apiv2.shiprocket.in/v1/external"
      : "http://127.0.0.1:9098/v1/external");

  const email = process.env.SHIPROCKET_EMAIL || (isProd ? "" : "operations@thehiddenlabel.com");
  const password = process.env.SHIPROCKET_PASSWORD || (isProd ? "" : "sandbox_secret_123");

  clientInstance = new ShiprocketClient({
    baseUrl,
    email,
    password,
  });

  return clientInstance;
}

export function setShiprocketClient(client: IShiprocketClient | null): void {
  clientInstance = client;
}
