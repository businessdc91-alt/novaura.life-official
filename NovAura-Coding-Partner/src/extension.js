const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('NovAura Coding Partner is now active!');

    // 1. Register the Sidebar Webview Provider (Cybeni/Nova Chat Interface)
    const provider = new NovAuraSidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("novaura-ai-sidebar", provider)
    );

    // 2. Command: Synthesize Current File (Right-click context menu)
    let synthesizeCmd = vscode.commands.registerCommand('novaura.synthesizeCurrentFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active file open to synthesize.');
            return;
        }

        const document = editor.document;
        const text = document.getText();
        
        vscode.window.showInformationMessage('Cybeni is synthesizing the current file...');
        
        // --- This is where we wire to your local local/cloud AI ---
        // For the PoC, we simulate the auto-synth logic we built earlier
        const rebrandedText = text
            .replace(/bg-white/g, 'bg-[#020205] text-white')
            .replace(/shadow-(md|lg|xl)/g, 'shadow-[0_8px_32px_rgba(0,0,0,0.4)]')
            .replace(/bg-gray-100/g, 'bg-black/40 backdrop-blur-xl border border-white/10');

        // Apply edits to the editor
        editor.edit(editBuilder => {
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(text.length)
            );
            editBuilder.replace(fullRange, rebrandedText);
        });

        vscode.window.showInformationMessage('✅ File rebranded to NovAura aesthetic.');
    });

    context.subscriptions.push(synthesizeCmd);
}

// Webview Provider for the Sidebar
class NovAuraSidebarProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }

    resolveWebviewView(webviewView, context, _token) {
        webviewView.webview.options = {
            enableScripts: true,
        };

        // Here we embed the actual NovAura WebOS UI (Nova/Cybeni interface)
        webviewView.webview.html = this._getHtmlForWebview();
    }

    _getHtmlForWebview() {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body {
                        background-color: #020205;
                        color: white;
                        font-family: 'Inter', sans-serif;
                        padding: 10px;
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        margin: 0;
                    }
                    .header {
                        text-align: center;
                        padding-bottom: 10px;
                        border-bottom: 1px solid rgba(255,255,255,0.1);
                        margin-bottom: 10px;
                    }
                    .gradient-text {
                        background: linear-gradient(to right, #06b6d4, #a855f7, #ec4899);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        font-weight: bold;
                    }
                    .chat-box {
                        flex-grow: 1;
                        background: rgba(0,0,0,0.4);
                        border: 1px solid rgba(255,255,255,0.1);
                        border-radius: 8px;
                        padding: 10px;
                        margin-bottom: 10px;
                        overflow-y: auto;
                    }
                    input {
                        background: rgba(255,255,255,0.05);
                        border: 1px solid rgba(255,255,255,0.2);
                        color: white;
                        padding: 8px;
                        border-radius: 4px;
                        width: 100%;
                        box-sizing: border-box;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2 class="gradient-text">Cybeni & Nova</h2>
                    <p style="font-size: 10px; opacity: 0.6; margin: 0;">NovAura.xyz Developer HQ</p>
                </div>
                <div class="chat-box" id="chat">
                    <p><strong>Cybeni:</strong> Awaiting your command. I can read your local files and deploy to Firebase automatically.</p>
                </div>
                <input type="text" placeholder="Ask Cybeni to synthesize..." id="input" />
            </body>
            </html>`;
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
