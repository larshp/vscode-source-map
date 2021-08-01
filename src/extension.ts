import * as vscode from 'vscode';
import { Panel } from './panel';

export function activate(context: vscode.ExtensionContext) {
  new Panel().register(context);
}