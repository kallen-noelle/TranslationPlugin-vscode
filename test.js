import * as vscode from 'vscode';
export function activate(context) {
    vscode.languages.registerHoverProvider('javascript', new (class {
        provideHover(_document, _position, _token) {
            const commentCommandUri = vscode.Uri.parse(`command:editor.action.addCommentLine`);
            const contents = new vscode.MarkdownString(`[Add comment](${commentCommandUri})`);
            // To enable command URIs in Markdown content, you must set the `isTrusted` flag.
            // When creating trusted Markdown string, make sure to properly sanitize all the
            // input content so that only expected command URIs can be executed
            contents.isTrusted = true;
            return new vscode.Hover(contents);
        }
    })());
}
//# sourceMappingURL=test.js.map