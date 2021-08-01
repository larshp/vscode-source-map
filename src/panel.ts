import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import * as sourceMap from "source-map";
import { ExtensionContext} from "vscode";

export class Panel {
  private helpPanel: vscode.WebviewPanel | undefined;
  private json: sourceMap.RawSourceMap | undefined;
  private channel: vscode.OutputChannel | undefined;

  public register(context: ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand("vscode-source-map.showMap", this.show.bind(this)));
    this.channel = vscode.window.createOutputChannel("vscode-source-map");
  }

  public buildHelp(html: string): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none';">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>source-map</title>
    </head>
    <body>` + html + `</body>
    </html>`;
  }

  public helpResponse(html: string) {
    if (this.helpPanel) {
      this.helpPanel.webview.html = this.buildHelp(html);
    }
  }

  public parsed(consumer: sourceMap.BasicSourceMapConsumer) {
    vscode.window.showInformationMessage('Parsed');

    let html = `version: ${this.json?.version}<br>
    file: ${this.json?.file}<br>
    sourceRoot: ${this.json?.sourceRoot}<br>
    <hr>
    <table border="1">
    <tr>
    <td>source</td>
    <td>name</td>
    <td>originalColumn</td>
    <td>originalLine</td>
    <td>generatedColumn</td>
    <td>generatedLine</td>
    </tr>`;

    let count = 1;
    consumer.eachMapping((m) => {
      this.channel?.appendLine(count + ": " + m.name);

      html += `<tr>
        <td>${m.source}</td>
        <td>${m.name}</td>
        <td align="right">${m.originalColumn}</td>
        <td align="right">${m.originalLine}</td>
        <td align="right">${m.generatedColumn}</td>
        <td align="right">${m.generatedLine}</td>
        </tr>\n`;
      count++;
    });

    html += `</table>\n`;

    if (this.helpPanel) {
      this.helpPanel.webview.html = this.buildHelp(html);
    }
    consumer.destroy();
  }

  public show() {
    const editor = vscode.window.activeTextEditor;
    if (editor === undefined) {
      return;
    }

    if (this.helpPanel === undefined) {
      this.helpPanel = vscode.window.createWebviewPanel(
        "vscode-source-map",
        "vscode-source-map",
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableFindWidget: true, enableCommandUris: true, enableScripts: true }
      );
      this.helpPanel.onDidDispose(() => { this.helpPanel = undefined; });
    } else {
      this.helpPanel.reveal(undefined, true);
    }

    try {
      this.json = JSON.parse(editor.document.getText());
      this.helpPanel.webview.html = this.buildHelp("loading " + Utils.basename(editor.document.uri));

      const base = Utils.dirname(editor.document.uri);
      this.channel?.appendLine("Basedir: " + base);

      new sourceMap.SourceMapConsumer(this.json!).then(this.parsed.bind(this));
    } catch (e) {
      this.helpPanel.webview.html = this.buildHelp("JSON Error: " + e);
    }
  }

}