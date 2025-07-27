import * as vscode from "vscode";
import { FontCodeManager } from "./fontCodeManager";
import { FontCodeHoverProvider } from "./hoverProvider";
import { EmojiPicker } from "./emojiPicker";
import { LocaleManager } from "./localeManager";

let fontCodeManager: FontCodeManager;
let emojiPicker: EmojiPicker;
let localeManager: LocaleManager;

export function activate(context: vscode.ExtensionContext) {
  localeManager = new LocaleManager(context);
  
  fontCodeManager = new FontCodeManager(context);
  emojiPicker = new EmojiPicker(context, fontCodeManager);

  const hoverProvider = new FontCodeHoverProvider(fontCodeManager);
  context.subscriptions.push(
    vscode.languages.registerHoverProvider("*", hoverProvider)
  );

  const convertCommand = vscode.commands.registerCommand(
    "fontcode.convertToUnicode",
    () => {
      convertSelectedTextToUnicode();
    }
  );
  context.subscriptions.push(convertCommand);

  const emojiPickerCommand = vscode.commands.registerCommand(
    "fontcode.showEmojiPicker",
    () => {
      emojiPicker.show();
    }
  );
  context.subscriptions.push(emojiPickerCommand);

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      fontCodeManager.updateDecorations();
    })
  );

  let changeTimeout: NodeJS.Timeout;
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (changeTimeout) {
        clearTimeout(changeTimeout);
      }
      changeTimeout = setTimeout(() => {
        if (vscode.window.activeTextEditor?.document === event.document) {
          fontCodeManager.updateDecorations();
        }
      }, 100);
    })
  );

  context.subscriptions.push({
    dispose: () => localeManager.dispose()
  });

  fontCodeManager.updateDecorations();

//   vscode.window.showInformationMessage(
//     vscode.l10n.t('extension.activated')
//   );
}

function convertSelectedTextToUnicode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const selection = editor.selection;
  let text: string;
  let range: vscode.Range;

  if (selection.isEmpty) {
    const position = selection.active;
    const wordRange = editor.document.getWordRangeAtPosition(
      position,
      /0xE[0-9A-F]{3}/i
    );
    if (!wordRange) {
    //   vscode.window.showInformationMessage(
    //     vscode.l10n.t('convert.noFontCodesFound')
    //   );
      return;
    }
    text = editor.document.getText(wordRange);
    range = wordRange;
  } else {
    text = editor.document.getText(selection);
    range = selection;
  }

  const regex = /0xE[0-9A-F]{3}/gi;
  const matches = text.match(regex);

  if (!matches) {
    // vscode.window.showInformationMessage(
    //   vscode.l10n.t('convert.noFontCodesFound')
    // );
    return;
  }

  let convertedText = text;
  matches.forEach((match) => {
    try {
      const codePoint = parseInt(match, 16);
      const unicodeChar = String.fromCharCode(codePoint);
      convertedText = convertedText.replace(match, unicodeChar);
    } catch (error) {
      console.error(`Error converting ${match}:`, error);
    }
  });

  editor.edit((editBuilder) => {
    editBuilder.replace(range, convertedText);
  });

  vscode.window.showInformationMessage(
    vscode.l10n.t('convert.success', matches.length)
  );
}

export function deactivate() {
  if (fontCodeManager) {
    fontCodeManager.dispose();
  }
  if (emojiPicker) {
    emojiPicker.dispose();
  }
  if (localeManager) {
    localeManager.dispose();
  }
}