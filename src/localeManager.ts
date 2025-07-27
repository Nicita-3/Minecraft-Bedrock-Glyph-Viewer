import * as vscode from 'vscode';

export class LocaleManager {
  private currentLocale: string = 'en';
  
  constructor(private context: vscode.ExtensionContext) {
    this.initializeLocale();
    this.watchConfigurationChanges();
  }

  private initializeLocale() {
    const config = vscode.workspace.getConfiguration('glyphViewer');
    const userLanguage = config.get<string>('language', 'auto');
    
    if (userLanguage === 'auto') {
      this.currentLocale = vscode.env.language;
    } else {
      this.currentLocale = userLanguage;
    }
  }

  private watchConfigurationChanges() {
    const disposable = vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('glyphViewer.language')) {
        this.initializeLocale();
        vscode.window.showInformationMessage(
          this.t('localeManager.restartRequired'),
          this.t('localeManager.restart')
        ).then(selection => {
          if (selection === this.t('localeManager.restart')) {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
        });
      }
    });

    this.context.subscriptions.push(disposable);
  }

  getCurrentLocale(): string {
    return this.currentLocale;
  }

  t(key: string, ...args: any[]): string {
    return vscode.l10n.t(key, ...args);
  }

  dispose() {

  }
}