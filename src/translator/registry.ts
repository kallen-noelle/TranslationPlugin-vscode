import * as vscode from 'vscode';
import { Config } from '../config.js';
import { Translator } from '../types.js';
import { GoogleTranslator } from './google.js';
import { MicrosoftTranslator } from './microsoft.js';
import { OpenAiTranslator } from './openai.js';

export const ENGINES: Translator[] = [GoogleTranslator, MicrosoftTranslator, OpenAiTranslator];

const STATE_KEY = 'activeEngine';

let activeEngineId: string | undefined;

export function initRegistry(ctx: vscode.ExtensionContext): void {
  activeEngineId = ctx.globalState.get<string>(STATE_KEY) ?? Config.get().defaultEngine;
}

export function getActiveEngine(): Translator {
  const id = activeEngineId ?? Config.get().defaultEngine;
  return ENGINES.find((e) => e.id === id) ?? GoogleTranslator;
}

export function getEngine(id: string): Translator | undefined {
  return ENGINES.find((e) => e.id === id);
}

export function getActiveEngineId(): string {
  return activeEngineId ?? Config.get().defaultEngine;
}

export async function setActiveEngine(ctx: vscode.ExtensionContext, id: string): Promise<void> {
  activeEngineId = id;
  await ctx.globalState.update(STATE_KEY, id);
}
