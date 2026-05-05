import * as vscode from 'vscode';
import * as http from 'http';

export function activate(context: vscode.ExtensionContext) {
    console.log('NovAura Code Companion is active');

    const chatProvider = new AuraChatProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('novaura.chatView', chatProvider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('novaura.askFrontier', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const selection = editor.selection;
                const text = editor.document.getText(selection);
                
                // Send to Tauri Hub
                chatProvider.sendMessageToHub('explain', {
                    code: text,
                    language: editor.document.languageId,
                    filePath: editor.document.uri.fsPath
                });
            }
        })
    );
}

class AuraChatProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'chat':
                    this.sendMessageToHub('chat', { message: data.value });
                    break;
            }
        });
    }

    public async sendMessageToHub(type: string, payload: any) {
        const config = vscode.workspace.getConfiguration('novaura');
        const hubUrl = config.get('hubUrl', 'http://localhost:5178');

        // Simple POST to Tauri Hub
        const data = JSON.stringify({ type, payload });
        const url = new URL('/v1/aura', hubUrl);

        const req = http.request({
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (this._view) {
                    this._view.webview.postMessage({ type: 'response', value: JSON.parse(body) });
                }
            });
        });

        req.on('error', e => {
            vscode.window.showErrorMessage(`NovAura Hub not found at ${hubUrl}. Is the Command Station running?`);
        });

        req.write(data);
        req.end();
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <style>
                    body { font-family: sans-serif; background: #0a0a0f; color: #fff; padding: 10px; }
                    #chat-container { height: calc(100vh - 100px); overflow-y: auto; margin-bottom: 10px; }
                    .msg { margin-bottom: 8px; padding: 8px; border-radius: 4px; }
                    .user { background: #1e2130; }
                    .aura { background: #4c65ff; }
                    #input-area { display: flex; gap: 4px; }
                    input { flex: 1; padding: 8px; background: #1e2130; border: 1px solid #333; color: #fff; }
                    button { padding: 8px; background: #4c65ff; border: none; color: #fff; cursor: pointer; }
                </style>
            </head>
            <body>
                <div id="chat-container"></div>
                <div id="input-area">
                    <input type="text" id="chat-input" placeholder="Ask Aura..." />
                    <button onclick="send()">Send</button>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();
                    const container = document.getElementById('chat-container');
                    const input = document.getElementById('chat-input');

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.type === 'response') {
                            addMsg('Aura', message.value.response, 'aura');
                        }
                    });

                    function send() {
                        const val = input.value;
                        if (!val) return;
                        addMsg('You', val, 'user');
                        vscode.postMessage({ type: 'chat', value: val });
                        input.value = '';
                    }

                    function addMsg(sender, text, cls) {
                        const div = document.createElement('div');
                        div.className = 'msg ' + cls;
                        div.innerHTML = '<strong>' + sender + ':</strong> ' + text;
                        container.appendChild(div);
                        container.scrollTop = container.scrollHeight;
                    }
                </script>
            </body>
            </html>
        `;
    }
}
