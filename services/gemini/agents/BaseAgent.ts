import { GeminiClient } from '../core';

export abstract class BaseAgent {
  protected client: GeminiClient;

  constructor(client: GeminiClient) {
    this.client = client;
  }
}
