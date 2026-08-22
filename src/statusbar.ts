import * as vscode from 'vscode';
import { ENGINES, getActiveEngine, setActiveEngine, getActiveEngineId } from './translator/registry.js';

const STATUS_COMMAND = 'translation.switchEngine';

let statusBarItem: vscode.StatusBarItem | undefined;

/** Creates and returns the status bar item that shows the active engine. */
export function createStatusBarItem(): vscode.StatusBarItem {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = STATUS_COMMAND;
  updateStatusBar();
  statusBarItem.show();
  return statusBarItem;
}

export function updateStatusBar(): void {
  if (!statusBarItem) {
    return;
  }
  const engine = getActiveEngine();
  statusBarItem.text = `$(globe) ${engine.name}`;
  statusBarItem.tooltip = `翻译引擎: ${engine.name}\n点击切换`;
}

/** Shows a QuickPick to switch the active translation engine. */
export async function pickEngine(ctx: vscode.ExtensionContext): Promise<void> {
  const currentId = getActiveEngineId();
  const picked = await vscode.window.showQuickPick(
    ENGINES.map((e) => ({
      label: e.name,
      description: e.id === currentId ? '当前' : undefined,
      id: e.id,
    })),
    { placeHolder: '选择翻译引擎' },
  );
  if (!picked) {
    return;
  }
  if (picked.id !== currentId) {
    await setActiveEngine(ctx, picked.id);
    updateStatusBar();
    void vscode.window.showInformationMessage(`已切换到 ${picked.label}`);
  }
}
