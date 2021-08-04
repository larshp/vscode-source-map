import * as vscode from 'vscode';
import { Utils } from 'vscode-uri';
import * as sourceMap from "source-map";
import { ExtensionContext} from "vscode";

let json: sourceMap.RawSourceMap | undefined = undefined;
let channel: vscode.OutputChannel | undefined = undefined;
let consumer: sourceMap.BasicSourceMapConsumer | undefined = undefined;
const green = vscode.window.createTextEditorDecorationType({outline: "1px solid green"});
const red = vscode.window.createTextEditorDecorationType({outline: "1px solid red"});

export class HoverProvider implements vscode.HoverProvider {
  public provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
    channel?.appendLine("hover: " + document.uri + " " + position.line + ":" + position.character);

    const decorations: vscode.DecorationOptions[] = [];
    const isSource = json?.sources.some(e => e === Utils.basename(document.uri));
    if (isSource === true) {
      channel?.appendLine("source file hover");
      const pos: sourceMap.MappedPosition = {
        source: json?.sources[0] || "",
        line: position.line + 1,
        column: position.character,
      };
      const found = consumer?.allGeneratedPositionsFor(pos);
      channel?.appendLine("found: " + found?.length);
      for (const f of found || []) {
        if (f.line === null || f.column === null || f.lastColumn === null) {
          continue;
        }
        channel?.appendLine(JSON.stringify(f));
        decorations.push({range: new vscode.Range(
          new vscode.Position(f.line-1, f.column),
          new vscode.Position(f.line-1, f.lastColumn+1))}
        );
      }

      const editors = vscode.window.visibleTextEditors;
      for (const editor of editors) {
        if (Utils.basename(editor.document.uri) === json?.file) {
          editor.setDecorations(green, decorations);
        } else {
          editor.setDecorations(green, []);
        }
      }
    } else if (Utils.basename(document.uri) === json?.file) {
      channel?.appendLine("generated file hover");
      const pos: sourceMap.Position = {
        line: position.line + 1,
        column: position.character,
      };
      const found = consumer?.originalPositionFor(pos);
      channel?.appendLine("found: " + JSON.stringify(found));
      if (found && found.line && found.column) {
        decorations.push({range: new vscode.Range(
          new vscode.Position(found.line-1, found.column),
          new vscode.Position(found.line-1, found.column+1))}
        );
      }

      const editors = vscode.window.visibleTextEditors;
      for (const editor of editors) {
        if (Utils.basename(editor.document.uri) === found?.source) {
          editor.setDecorations(red, decorations);
        } else {
          editor.setDecorations(red, []);
        }
      }

    } else {
      channel?.appendLine("File is not valid for opened map");
    }

    return undefined;
  }
}

export class Panel {
  private helpPanel: vscode.WebviewPanel | undefined;

  public register(context: ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand("vscode-source-map.showMap", this.show.bind(this)));
    channel = vscode.window.createOutputChannel("vscode-source-map");

    vscode.languages.registerHoverProvider('*', new HoverProvider());
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

  public parsed(c: sourceMap.BasicSourceMapConsumer) {
    consumer = c;
    consumer?.computeColumnSpans();
    vscode.window.showInformationMessage('Parsed');

    let html = `version: ${json?.version}<br>
    file: ${json?.file}<br>
    sourceRoot: ${json?.sourceRoot}<br>
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
      channel?.appendLine(count + ": " + m.name);

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
      if (consumer) {
        consumer.destroy();
      }
      consumer = undefined;
      json = undefined;

      json = JSON.parse(editor.document.getText());
      this.helpPanel.webview.html = this.buildHelp("loading " + Utils.basename(editor.document.uri));

      const base = Utils.dirname(editor.document.uri);
      channel?.appendLine("Basedir: " + base);

      new sourceMap.SourceMapConsumer(json!).then(this.parsed.bind(this));
    } catch (e) {
      this.helpPanel.webview.html = this.buildHelp("JSON Error: " + e);
    }
  }

}