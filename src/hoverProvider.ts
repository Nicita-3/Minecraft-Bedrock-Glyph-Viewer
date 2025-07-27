import * as vscode from "vscode";
import { FontCodeManager } from "./fontCodeManager";

export class FontCodeHoverProvider implements vscode.HoverProvider {
  constructor(private fontCodeManager: FontCodeManager) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    let range = document.getWordRangeAtPosition(position, /0xE[0-9A-F]{3}/i);
    let fontCode: string;

    if (range) {
      fontCode = document.getText(range);
    } else {
      const char = document.getText(
        new vscode.Range(position, position.translate(0, 1))
      );
      const codePoint = char.charCodeAt(0);

      if (codePoint >= 0xe000 && codePoint <= 0xefff) {
        fontCode = `0x${codePoint.toString(16).toUpperCase()}`;
        range = new vscode.Range(position, position.translate(0, 1));
      } else {
        return null;
      }
    }

    try {
      const imageUri = await this.fontCodeManager.getImageForHover(fontCode);
      if (!imageUri) {
        return null;
      }

      const markdown = new vscode.MarkdownString();
      markdown.appendMarkdown(`**Font Code:** \`${fontCode}\`\n\n`);
      markdown.appendMarkdown(`![Glyph](${imageUri.toString()})\n\n`);

      try {
        const codePoint = parseInt(fontCode, 16);
        const unicodeChar = String.fromCharCode(codePoint);
        markdown.appendMarkdown(
          `**Unicode:** \`${unicodeChar}\` (${codePoint})`
        );
      } catch (error) {}

      markdown.isTrusted = true;

      return new vscode.Hover(markdown, range);
    } catch (error) {
      console.error(`Помилка hover для ${fontCode}:`, error);
      return null;
    }
  }
}
