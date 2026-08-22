import * as vscode from 'vscode';
import { Config } from './config.js';
import { Store } from './store.js';
import { initRegistry } from './translator/registry.js';
import { registerCommands } from './commands.js';
import { registerHoverProvider } from './hover.js';
import { registerWordBookView } from './wordBookView.js';

export function activate(context: vscode.ExtensionContext): void {
  Config.init(context);
  Store.init(context);
  initRegistry(context);

  registerWordBookView(context);

  context.subscriptions.push(
    ...registerCommands({ ctx: context }),
    registerHoverProvider(),
  );
}

export function deactivate(): void {
  // Nothing to clean up: subscriptions are disposed by VS Code.
}
