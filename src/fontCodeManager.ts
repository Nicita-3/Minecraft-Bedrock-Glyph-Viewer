import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ImageProcessor } from "./imageProcessor";

export class FontCodeManager {
  private imageProcessor: ImageProcessor;
  private decorationType: vscode.TextEditorDecorationType;
  private decorations: Map<string, vscode.DecorationOptions[]> = new Map();
  private updateTimeout: NodeJS.Timeout | undefined;
  private lastDocumentVersion: number = -1;
  private fontFileCache: Map<string, string | null> = new Map();

  constructor(private context: vscode.ExtensionContext) {
    this.imageProcessor = new ImageProcessor(context);
    this.decorationType = vscode.window.createTextEditorDecorationType({
      textDecoration: "none",
    });
  }

  async updateDecorations() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const document = editor.document;

    if (document.version === this.lastDocumentVersion) {
      return;
    }
    this.lastDocumentVersion = document.version;

    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(async () => {
      await this.performDecorationUpdate(editor, document);
    }, 100);
  }

  private async performDecorationUpdate(
    editor: vscode.TextEditor,
    document: vscode.TextDocument
  ) {
    const text = document.getText();
    const decorationsArray: vscode.DecorationOptions[] = [];

    const foundCodes = new Set<string>();

    const codeRegex = /0xE[0-9A-F]{3}/gi;
    let match;

    const codeMatches: { code: string; range: vscode.Range }[] = [];

    while ((match = codeRegex.exec(text)) !== null) {
      const fontCode = match[0];
      const startPos = document.positionAt(match.index);
      const endPos = document.positionAt(match.index + match[0].length);
      const range = new vscode.Range(startPos, endPos);

      foundCodes.add(fontCode);
      codeMatches.push({ code: fontCode, range });
    }

    const unicodeMatches: { code: string; range: vscode.Range }[] = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const codePoint = char.charCodeAt(0);

      if (codePoint >= 0xe000 && codePoint <= 0xefff) {
        const fontCode = `0x${codePoint.toString(16).toUpperCase()}`;
        const startPos = document.positionAt(i);
        const endPos = document.positionAt(i + 1);
        const range = new vscode.Range(startPos, endPos);

        foundCodes.add(fontCode);
        unicodeMatches.push({ code: fontCode, range });
      }
    }

    await this.preloadFontFiles(foundCodes);

    const decorationPromises: Promise<void>[] = [];

    for (const { code, range } of codeMatches) {
      decorationPromises.push(
        this.addDecorationForCode(code, range, decorationsArray)
      );
    }

    for (const { code, range } of unicodeMatches) {
      decorationPromises.push(
        this.addDecorationForCode(code, range, decorationsArray)
      );
    }

    try {
      await Promise.race([
        Promise.all(decorationPromises),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 5000)
        ),
      ]);
    } catch (error) {
      console.warn("Деякі декорації не вдалося завантажити вчасно:", error);
    }

    editor.setDecorations(this.decorationType, decorationsArray);
    this.decorations.set(document.uri.toString(), decorationsArray);
  }

  private async preloadFontFiles(codes: Set<string>): Promise<void> {
    const prefixesToLoad = new Set<string>();

    for (const code of codes) {
      const prefix = code.substring(2, 4);
      prefixesToLoad.add(prefix);
    }

    const loadPromises = Array.from(prefixesToLoad).map(async (prefix) => {
      const filename = `glyph_${prefix}.png`;
      if (!this.fontFileCache.has(filename)) {
        const filePath = await this.findFontFile(filename);
        this.fontFileCache.set(filename, filePath);
      }
    });

    await Promise.all(loadPromises);
  }

  private async addDecorationForCode(
    fontCode: string,
    range: vscode.Range,
    decorationsArray: vscode.DecorationOptions[]
  ) {
    try {
      const imageUri = await this.getImageForCode(fontCode);
      if (imageUri) {
        const decoration: vscode.DecorationOptions = {
          range,
          renderOptions: {
            after: {
              contentIconPath: imageUri,
              margin: "0 0 0 2px",
            },
          },
        };
        decorationsArray.push(decoration);
      }
    } catch (error) {
      console.error(`Помилка обробки ${fontCode}:`, error);
    }
  }

  private async getImageForCode(fontCode: string): Promise<vscode.Uri | null> {
    try {
      const code = fontCode.substring(2);
      const prefix = code.substring(0, 2);
      const row = parseInt(code.substring(2, 3), 16);
      const col = parseInt(code.substring(3, 4), 16);

      const filename = `glyph_${prefix}.png`;
      const pngPath = this.fontFileCache.get(filename);

      if (!pngPath) {
        return null;
      }

      return await this.imageProcessor.extractGlyphImage(
        pngPath,
        row,
        col,
        fontCode
      );
    } catch (error) {
      console.error(`Помилка отримання зображення для ${fontCode}:`, error);
      return null;
    }
  }

  private async findFontFile(filename: string): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return null;
    }

    const searchPromises = workspaceFolders.map((folder) =>
      this.searchForFontFile(folder.uri.fsPath, filename)
    );

    const results = await Promise.allSettled(searchPromises);

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        return result.value;
      }
    }

    return null;
  }

  private async searchForFontFile(
    dir: string,
    filename: string
  ): Promise<string | null> {
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory() && item.name === "font") {
          const fontFilePath = path.join(dir, item.name, filename);
          if (fs.existsSync(fontFilePath)) {
            return fontFilePath;
          }
        }
      }

      const searchPromises: Promise<string | null>[] = [];
      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (
          item.isDirectory() &&
          item.name !== "node_modules" &&
          item.name !== ".git" &&
          !item.name.startsWith(".")
        ) {
          searchPromises.push(this.searchForFontFile(fullPath, filename));
        }
      }

      const batchSize = 5;
      for (let i = 0; i < searchPromises.length; i += batchSize) {
        const batch = searchPromises.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch);

        for (const result of results) {
          if (result.status === "fulfilled" && result.value) {
            return result.value;
          }
        }
      }
    } catch (error) {}

    return null;
  }

  async getImageForHover(fontCode: string): Promise<vscode.Uri | null> {
    return this.getImageForCode(fontCode);
  }

  dispose() {
    this.decorationType.dispose();
    this.imageProcessor.dispose();
    this.fontFileCache.clear();

    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
  }
}
