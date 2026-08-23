import * as vscode from 'vscode';

const CFG_SECTION = 'translation';

/**
 * Wraps workspace configuration and secret storage for the extension.
 */
export class Config {
  private constructor(private readonly ctx: vscode.ExtensionContext) {}

  private static instance: Config | undefined;

  static init(ctx: vscode.ExtensionContext): Config {
    Config.instance = new Config(ctx);
    return Config.instance;
  }

  static get(): Config {
    if (!Config.instance) {
      throw new Error('Config not initialized');
    }
    return Config.instance;
  }

  get<T>(key: string, defaultValue: T): T {
    return vscode.workspace.getConfiguration(CFG_SECTION).get<T>(key, defaultValue);
  }

  get defaultEngine(): string {
    return this.get('defaultEngine', 'google');
  }

  get sourceLanguage(): string {
    return this.get('sourceLanguage', 'auto');
  }

  get targetLanguage(): string {
    return this.get('targetLanguage', 'zh-CN');
  }

  get replaceSeparator(): string {
    return this.get('replaceSeparator', 'original');
  }

  get hoverEnabled(): boolean {
    return this.get('hover.enabled', true);
  }

  get hoverDelay(): number {
    return this.get('hover.delay', 300);
  }

  get hoverDocTranslation(): boolean {
    return this.get('hover.docTranslation', true);
  }

  get ttsEngine(): string {
    return this.get('ttsEngine', 'edge');
  }

  get edgeVoice(): string {
    return this.get('tts.edge.voice', '');
  }

  get edgeSpeedPercent(): number {
    const raw = this.get('tts.edge.speed', '0%');
    const match = /([+-]?\d+)%/.exec(raw);
    return match ? Number.parseInt(match[1], 10) : 0;
  }

  get openAiVoice(): string {
    return this.get('tts.openai.voice', 'alloy');
  }

  get openAiBaseUrl(): string {
    return this.get('openai.baseUrl', 'https://api.openai.com').replace(/\/+$/, '');
  }

  get openAiModel(): string {
    return this.get('openai.model', 'gpt-4o-mini');
  }

  get historyMaxEntries(): number {
    return this.get('history.maxEntries', 100);
  }

  get wordbookPath(): string | undefined {
    const p = this.get<string>('wordbook.path', '');
    return p.trim() || undefined;
  }

  get showResultInNotification(): boolean {
    return this.get('notification.showResult', true);
  }

  get wordOfDayAutoShow(): boolean {
    return this.get('wordOfDay.autoShow', true);
  }

  get wordOfDayAutoShowDelay(): number {
    return this.get('wordOfDay.autoShowDelay', 5);
  }

  /** Retrieves the API key for an engine, stored in the OS secret storage. */
  async getApiKey(engine: string): Promise<string | undefined> {
    return this.ctx.secrets.get(`${engine}.apiKey`);
  }

  async setApiKey(engine: string, apiKey: string): Promise<void> {
    if (apiKey.trim()) {
      await this.ctx.secrets.store(`${engine}.apiKey`, apiKey.trim());
    } else {
      await this.ctx.secrets.delete(`${engine}.apiKey`);
    }
  }
}
