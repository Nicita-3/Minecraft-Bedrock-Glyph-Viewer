import * as vscode from "vscode";
import { FontCodeManager } from "./fontCodeManager";
import { FontCodeHoverProvider } from "./hoverProvider";
import { EmojiPicker } from "./emojiPicker";

let fontCodeManager: FontCodeManager;
let emojiPicker: EmojiPicker;

export function activate(context: vscode.ExtensionContext) {
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

  fontCodeManager.updateDecorations();

  vscode.window.showInformationMessage(
    "Font Code Unicode Viewer активовано! Використовуйте Ctrl+Shift+E для відкриття Emoji Picker."
  );
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
      vscode.window.showInformationMessage(
        "Не знайдено коди шрифтів для конвертації"
      );
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
    vscode.window.showInformationMessage(
      "Не знайдено коди шрифтів для конвертації"
    );
    return;
  }

  let convertedText = text;
  matches.forEach((match) => {
    try {
      const codePoint = parseInt(match, 16);
      const unicodeChar = String.fromCharCode(codePoint);
      convertedText = convertedText.replace(match, unicodeChar);
    } catch (error) {
      console.error(`Помилка конвертації ${match}:`, error);
    }
  });

  editor.edit((editBuilder) => {
    editBuilder.replace(range, convertedText);
  });

  vscode.window.showInformationMessage(
    `Конвертовано ${matches.length} символів`
  );
}

export function deactivate() {
  if (fontCodeManager) {
    fontCodeManager.dispose();
  }
  if (emojiPicker) {
    emojiPicker.dispose();
  }
}
