
import { GeminiClient } from "../core";

export abstract class BaseAgent {
  protected client: GeminiClient;

  constructor(client?: GeminiClient) {
    // If no client provided, fallback to default (env key)
    if (client) {
      this.client = client;
    } else {
      this.client = new GeminiClient(process.env.API_KEY || "");
    }
  }
}
