import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import sharp from "sharp";
import { FontCodeManager } from "./fontCodeManager";

interface EmojiInfo {
  code: string;
  unicode: string;
  row: number;
  col: number;
  imageUri?: vscode.Uri;
  localImagePath?: string;
}

interface FontPage {
  filename: string;
  prefix: string;
  emojis: EmojiInfo[];
  imagePath: string;
}

export class EmojiPicker {
  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private fontCodeManager: FontCodeManager;
  private fontPages: FontPage[] = [];
  private currentPage: number = 0;

  constructor(
    context: vscode.ExtensionContext,
    fontCodeManager: FontCodeManager
  ) {
    this.context = context;
    this.fontCodeManager = fontCodeManager;
  }

  async show() {
    try {
      if (this.panel) {
        this.panel.reveal();
        return;
      }

      const emojiCacheDir = vscode.Uri.file(
        path.join(this.context.globalStorageUri.fsPath, "emoji_cache")
      );
      await fs.promises.mkdir(emojiCacheDir.fsPath, { recursive: true });

      this.panel = vscode.window.createWebviewPanel(
        "emojiPicker",
        vscode.l10n.t('emojiPicker.title'),
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(path.join(this.context.extensionPath, "media")),
            this.context.globalStorageUri,
            emojiCacheDir,
            ...(vscode.workspace.workspaceFolders?.map(
              (folder) => folder.uri
            ) || []),
          ],
        }
      );
      this.panel.webview.html = this.getWebviewContent();

      this.panel.webview.onDidReceiveMessage(
        async (message) => {
          try {
            switch (message.command) {
              case "insertEmoji":
                await this.insertEmoji(message.unicode);
                break;
              case "copyCode":
                await this.copyToClipboard(message.code);
                break;
              case "copyUnicode":
                await this.copyToClipboard(message.unicode);
                break;
              case "changePage":
                this.currentPage = message.page;
                await this.updatePageContent();
                break;
              case "ready":
                await this.loadAndSendData();
                break;
            }
          } catch (error) {
            console.error("EmojiPicker: Error processing message:", error);
            vscode.window.showErrorMessage(
              vscode.l10n.t(
                'emojiPicker.error.processing',
                error instanceof Error ? error.message : String(error)
              )
            );
          }
        },
        undefined,
        this.context.subscriptions
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    } catch (error) {
      console.error("EmojiPicker: Error showing picker:", error);
      vscode.window.showErrorMessage(
        vscode.l10n.t(
          'emojiPicker.error.opening',
          (error instanceof Error ? error.message : String(error))
        )
      );
    }
  }

  private async loadAndSendData() {
    try {
      await this.loadFontPages();
      await this.updatePageContent();
    } catch (error) {
      console.error("EmojiPicker: Error loading data:", error);
      if (this.panel) {
        this.panel.webview.postMessage({
          command: "error",
          message: vscode.l10n.t('emojiPicker.error.loading', error instanceof Error ? error.message : String(error)),
        });
      }
    }
  }

  private async loadFontPages() {
    this.fontPages = [];
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
      return;
    }
    for (const folder of workspaceFolders) {
      const fontFiles = await this.findAllFontFiles(folder.uri.fsPath);

      for (const filePath of fontFiles) {
        const filename = path.basename(filePath);
        const match = filename.match(/glyph_E([0-9A-F])\.png/i);

        if (match) {
          const prefix = match[1].toUpperCase();

          try {
            const emojis = await this.extractEmojisFromFile(filePath, prefix);

            if (emojis.length > 0) {
              this.fontPages.push({
                filename,
                prefix,
                emojis,
                imagePath: filePath,
              });
            }
          } catch (error) {
            console.error(`EmojiPicker: Error processing ${filename}:`, error);
          }
        }
      }
    }

    this.fontPages.sort((a, b) => a.prefix.localeCompare(b.prefix));
  }

  private async findAllFontFiles(dir: string): Promise<string[]> {
    const result: string[] = [];

    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory()) {
          if (item.name === "font") {
            try {
              const fontItems = await fs.promises.readdir(fullPath);
              for (const fontFile of fontItems) {
                if (fontFile.match(/glyph_E[0-9A-F]\.png/i)) {
                  const fontFilePath = path.join(fullPath, fontFile);
                  result.push(fontFilePath);
                }
              }
            } catch (error) {
              console.error(
                `EmojiPicker: Error reading font folder ${fullPath}:`,
                error
              );
            }
          } else if (
            !item.name.startsWith(".") &&
            item.name !== "node_modules"
          ) {
            try {
              const subResults = await this.findAllFontFiles(fullPath);
              result.push(...subResults);
            } catch (error) {}
          }
        }
      }
    } catch (error) {
      console.error(`EmojiPicker: Error reading directory ${dir}:`, error);
    }

    return result;
  }

  private async extractEmojisFromFile(
    filePath: string,
    prefix: string
  ): Promise<EmojiInfo[]> {
    const emojis: EmojiInfo[] = [];

    try {
      if (!fs.existsSync(filePath)) {
        console.error(`EmojiPicker: File does not exist: ${filePath}`);
        return emojis;
      }

      const image = sharp(filePath);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        console.error(
          `EmojiPicker: Could not get image dimensions: ${filePath}`
        );
        return emojis;
      }

      const cellWidth = Math.floor(metadata.width / 16);
      const cellHeight = Math.floor(metadata.height / 16);

      const tempDir = path.join(
        this.context.globalStorageUri.fsPath,
        "emoji_cache",
        prefix
      );
      await fs.promises.mkdir(tempDir, { recursive: true });

      for (let row = 0; row < 16; row++) {
        for (let col = 0; col < 16; col++) {
          const codeHex = `E${prefix}${row.toString(16).toUpperCase()}${col
            .toString(16)
            .toUpperCase()}`;
          const code = `0x${codeHex}`;
          const codePoint = parseInt(codeHex, 16);
          const unicode = String.fromCharCode(codePoint);
          const emojiImagePath = await this.createEmojiImage(
            image,
            row,
            col,
            cellWidth,
            cellHeight,
            tempDir,
            codeHex
          );
          const isValid = await this.isCellValid(
            image,
            row,
            col,
            cellWidth,
            cellHeight
          );

          if (isValid && emojiImagePath) {
            let imageUri = vscode.Uri.file(emojiImagePath);

            emojis.push({
              code,
              unicode,
              row,
              col,
              imageUri,
              localImagePath: emojiImagePath,
            });
          }
        }
      }
    } catch (error) {
      console.error(`EmojiPicker: Error processing file ${filePath}:`, error);
    }
    return emojis;
  }

  private async createEmojiImage(
    image: sharp.Sharp,
    row: number,
    col: number,
    cellWidth: number,
    cellHeight: number,
    outputDir: string,
    codeHex: string
  ): Promise<string | null> {
    try {
      const left = col * cellWidth;
      const top = row * cellHeight;
      const outputPath = path.join(outputDir, `${codeHex}.png`);
      
      const baseSize = Math.max(cellWidth, cellHeight);
      const targetSize = Math.max(64, baseSize * 4);
      
      await image
        .clone()
        .extract({ left, top, width: cellWidth, height: cellHeight })
        .resize(targetSize, targetSize, {
          kernel: sharp.kernel.nearest,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png({
          compressionLevel: 0,
          palette: false
        })
        .toFile(outputPath);

      if (fs.existsSync(outputPath)) {
        return outputPath;
      } else {
        console.error(`EmojiPicker: File was not created: ${outputPath}`);
        return null;
      }
    } catch (error) {
      console.error(
        `EmojiPicker: Error creating emoji image ${codeHex}:`,
        error
      );
      return null;
    }
  }

  private async isCellValid(
    image: sharp.Sharp,
    row: number,
    col: number,
    cellWidth: number,
    cellHeight: number
  ): Promise<boolean> {
    try {
      const left = col * cellWidth;
      const top = row * cellHeight;

      const { data, info } = await sharp(
        await image
          .clone()
          .extract({ left, top, width: cellWidth, height: cellHeight })
          .png()
          .toBuffer()
      )
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const channels = info.channels;

      for (let i = 3; i < data.length; i += channels) {
        if (data[i] > 0) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("Error in isCellValid:", error);
      return false;
    }
  }

  private getWebviewContent(): string {
    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${vscode.l10n.t('emojiPicker.title')}</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 10px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    margin: 0;
                }
                
                .header {
                    margin-bottom: 15px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 10px;
                }
                
                .controls {
                    display: flex;
                    gap: 20px;
                    align-items: center;
                    flex-wrap: wrap;
                    margin-bottom: 10px;
                }
                
                .page-selector {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .scale-controls {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .page-selector select, .scale-controls input {
                    background-color: var(--vscode-dropdown-background);
                    color: var(--vscode-dropdown-foreground);
                    border: 1px solid var(--vscode-dropdown-border);
                    padding: 5px;
                    font-family: inherit;
                }
                
                .scale-controls input[type="range"] {
                    width: 100px;
                }
                
                .scale-controls span {
                    min-width: 40px;
                    font-size: 0.9em;
                    color: var(--vscode-descriptionForeground);
                }
                
                .page-info {
                    font-size: 0.9em;
                    color: var(--vscode-descriptionForeground);
                    margin-bottom: 15px;
                }
                
                .emoji-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(var(--emoji-size, 80px), 1fr));
                    gap: 8px;
                    max-height: 500px;
                    overflow-y: auto;
                }
                
                .emoji-item {
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    text-align: center;
                    cursor: pointer;
                    background-color: var(--vscode-button-secondaryBackground);
                    transition: all 0.2s;
                    min-height: var(--emoji-size, 80px);
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    align-items: center;
                    position: relative;
                    padding: 4px;
                }
                
                .emoji-item:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                    transform: scale(1.05);
                }
                
                .emoji-item:active {
                    transform: scale(0.95);
                }
                
                .emoji-image-container {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    min-height: 0;
                }
                
                .emoji-image {
                    max-width: calc(var(--emoji-size, 80px) * 0.85);
                    max-height: calc(var(--emoji-size, 80px) * 0.75);
                    width: auto;
                    height: auto;
                    /* Critical CSS for pixel art preservation */
                    image-rendering: -moz-crisp-edges;
                    image-rendering: -webkit-crisp-edges;
                    image-rendering: pixelated;
                    image-rendering: crisp-edges;
                    -ms-interpolation-mode: nearest-neighbor;
                    /* Prevent smoothing in different browsers */
                    -webkit-font-smoothing: never;
                    -moz-osx-font-smoothing: unset;
                    object-fit: contain;
                    display: block;
                    /* Ensure sharp scaling */
                    transform-origin: center;
                }
                
                /* Fallback for older browsers */
                @supports not (image-rendering: pixelated) {
                    .emoji-image {
                        image-rendering: -moz-crisp-edges;
                        image-rendering: -webkit-optimize-contrast;
                        -ms-interpolation-mode: nearest-neighbor;
                    }
                }
                
                .emoji-image.broken {
                    display: none;
                }
                
                .emoji-char {
                    font-size: calc(var(--emoji-size, 80px) * 0.3);
                    line-height: 1;
                    display: none;
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    /* Apply same rendering to fallback text */
                    text-rendering: optimizeSpeed;
                    font-smooth: never;
                    -webkit-font-smoothing: none;
                }
                
                .emoji-char.fallback {
                    display: flex;
                }
                
                .emoji-code {
                    font-size: calc(var(--emoji-size, 80px) * 0.09);
                    color: var(--vscode-descriptionForeground);
                    font-family: var(--vscode-editor-font-family);
                    word-break: break-all;
                    padding: 1px 2px;
                    line-height: 1.1;
                    background-color: rgba(0,0,0,0.1);
                    border-radius: 2px;
                    margin-top: 1px;
                    min-font-size: 8px;
                }
                
                .context-menu {
                    position: fixed;
                    background-color: var(--vscode-menu-background);
                    border: 1px solid var(--vscode-menu-border);
                    border-radius: 4px;
                    padding: 4px 0;
                    z-index: 1000;
                    display: none;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                }
                
                .context-menu-item {
                    padding: 8px 16px;
                    cursor: pointer;
                    color: var(--vscode-menu-foreground);
                    font-size: 0.9em;
                }
                
                .context-menu-item:hover {
                    background-color: var(--vscode-menu-selectionBackground);
                    color: var(--vscode-menu-selectionForeground);
                }
                
                .loading {
                    text-align: center;
                    padding: 40px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .no-emojis {
                    text-align: center;
                    padding: 40px;
                    color: var(--vscode-descriptionForeground);
                }
                
                .error {
                    text-align: center;
                    padding: 40px;
                    color: var(--vscode-errorForeground);
                    background-color: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    border-radius: 4px;
                }

                /* High DPI / Retina display optimizations */
                @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
                    .emoji-image {
                        /* Force hardware acceleration for better pixel rendering */
                        transform: translateZ(0);
                        will-change: transform;
                    }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>${vscode.l10n.t('emojiPicker.title')}</h2>
                <div class="controls">
                    <div class="page-selector">
                        <label for="pageSelect">${vscode.l10n.t('emojiPicker.fontPage')}: </label>
                        <select id="pageSelect">
                            <option value="">${vscode.l10n.t('emojiPicker.loading')}...</option>
                        </select>
                    </div>
                    <div class="scale-controls">
                        <label for="scaleRange">${vscode.l10n.t('emojiPicker.scale')}: </label>
                        <input type="range" id="scaleRange" min="50" max="200" value="100" step="10">
                        <span id="scaleValue">100%</span>
                    </div>
                </div>
                <div class="page-info" id="pageInfo">${vscode.l10n.t('emojiPicker.loadingData')}...</div>
            </div>
            
            <div class="emoji-grid" id="emojiGrid">
                <div class="loading">${vscode.l10n.t('emojiPicker.loadingEmojis')}...</div>
            </div>
            
            <div class="context-menu" id="contextMenu">
                <div class="context-menu-item" data-action="insert">${vscode.l10n.t('emojiPicker.context.insert')}</div>
                <div class="context-menu-item" data-action="copy-unicode">${vscode.l10n.t('emojiPicker.context.copyUnicode')}</div>
                <div class="context-menu-item" data-action="copy-code">${vscode.l10n.t('emojiPicker.context.copyCode')}</div>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                let currentEmoji = null;
                let pages = [];
                let currentPageIndex = 0;
                
                vscode.postMessage({ command: 'ready' });
                
                document.getElementById('scaleRange').addEventListener('input', (e) => {
                    const scale = e.target.value;
                    document.getElementById('scaleValue').textContent = scale + '%';
                    
                    const size = Math.round(80 * scale / 100);
                    document.documentElement.style.setProperty('--emoji-size', size + 'px');
                });
                
                document.getElementById('pageSelect').addEventListener('change', (e) => {
                    const pageIndex = parseInt(e.target.value);
                    if (!isNaN(pageIndex)) {
                        currentPageIndex = pageIndex;
                        vscode.postMessage({
                            command: 'changePage',
                            page: pageIndex
                        });
                    }
                });
                
                document.addEventListener('click', () => {
                    document.getElementById('contextMenu').style.display = 'none';
                });
                
                document.getElementById('contextMenu').addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    if (action && currentEmoji) {
                        switch (action) {
                            case 'insert':
                                vscode.postMessage({
                                    command: 'insertEmoji',
                                    unicode: currentEmoji.unicode
                                });
                                break;
                            case 'copy-unicode':
                                vscode.postMessage({
                                    command: 'copyUnicode',
                                    unicode: currentEmoji.unicode
                                });
                                break;
                            case 'copy-code':
                                vscode.postMessage({
                                    command: 'copyCode',
                                    code: currentEmoji.code
                                });
                                break;
                        }
                    }
                    document.getElementById('contextMenu').style.display = 'none';
                });
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    switch (message.command) {
                        case 'updatePages':
                            pages = message.pages;
                            updatePageSelector();
                            break;
                        case 'updatePageContent':
                            updateEmojiGrid(message.emojis, message.pageInfo);
                            break;
                        case 'error':
                            showError(message.message);
                            break;
                    }
                });
                
                function updatePageSelector() {
                    const select = document.getElementById('pageSelect');
                    select.innerHTML = '';
                    
                    if (pages.length === 0) {
                        const option = document.createElement('option');
                        option.value = '';
                        option.textContent = '${vscode.l10n.t('emojiPicker.noFontFiles')}';
                        select.appendChild(option);
                        return;
                    }
                    
                    pages.forEach((page, index) => {
                        const option = document.createElement('option');
                        option.value = index;
                        option.textContent = \`glyph_E\${page.prefix}.png (\${page.emojis.length} ${vscode.l10n.t('emojiPicker.emojis')})\`;
                        select.appendChild(option);
                    });
                    
                    if (pages.length > 0) {
                        select.value = currentPageIndex.toString();
                    }
                }
                
                function updateEmojiGrid(emojis, pageInfo) {
                    const grid = document.getElementById('emojiGrid');
                    const info = document.getElementById('pageInfo');
                    
                    info.textContent = pageInfo;
                    
                    if (emojis.length === 0) {
                        grid.innerHTML = '<div class="no-emojis">${vscode.l10n.t('emojiPicker.noEmojisFound')}</div>';
                        return;
                    }
                    
                    grid.innerHTML = '';
                    
                    emojis.forEach(emoji => {
                        const item = document.createElement('div');
                        item.className = 'emoji-item';
                        
                        const imageContainer = document.createElement('div');
                        imageContainer.className = 'emoji-image-container';
                        
                        const charDiv = document.createElement('div');
                        charDiv.className = 'emoji-char';
                        charDiv.textContent = emoji.unicode;
                        
                        const codeDiv = document.createElement('div');
                        codeDiv.className = 'emoji-code';
                        codeDiv.textContent = emoji.code;
                        
                        if (emoji.imageUri) {
                            const img = document.createElement('img');
                            img.className = 'emoji-image';
                            img.src = emoji.imageUri;
                            img.alt = emoji.code;
                            
                            img.onerror = function() {
                                console.error('Failed to load image for', emoji.code, 'URL:', emoji.imageUri);
                                this.classList.add('broken');
                                charDiv.classList.add('fallback');
                                imageContainer.appendChild(charDiv);
                            };
                            
                            img.onload = function() {
                                charDiv.classList.remove('fallback');
                            };
                            
                            imageContainer.appendChild(img);
                        } else {
                            console.warn('No image for', emoji.code);
                            charDiv.classList.add('fallback');
                            imageContainer.appendChild(charDiv);
                        }
                        
                        item.appendChild(imageContainer);
                        item.appendChild(codeDiv);
                        
                        item.addEventListener('click', (e) => {
                            e.preventDefault();
                            vscode.postMessage({
                                command: 'insertEmoji',
                                unicode: emoji.unicode
                            });
                        });
                        
                        item.addEventListener('contextmenu', (e) => {
                            e.preventDefault();
                            currentEmoji = emoji;
                            
                            const menu = document.getElementById('contextMenu');
                            menu.style.display = 'block';
                            menu.style.left = e.pageX + 'px';
                            menu.style.top = e.pageY + 'px';
                        });
                        
                        grid.appendChild(item);
                    });
                }
                
                function showError(message) {
                    console.error('Error:', message);
                    const grid = document.getElementById('emojiGrid');
                    grid.innerHTML = \`<div class="error">${vscode.l10n.t('emojiPicker.error')}: \${message}</div>\`;
                    
                    const info = document.getElementById('pageInfo');
                    info.textContent = '${vscode.l10n.t('emojiPicker.errorLoadingData')}';
                }
            </script>
        </body>
        </html>`;
  }

  private async updatePageContent() {
    if (!this.panel || this.fontPages.length === 0) {
      if (this.panel) {
        this.panel.webview.postMessage({
          command: "updatePages",
          pages: [],
        });

        this.panel.webview.postMessage({
          command: "updatePageContent",
          emojis: [],
          pageInfo: vscode.l10n.t('emojiPicker.noFontFilesInProject'),
        });
      }
      return;
    }

    this.panel.webview.postMessage({
      command: "updatePages",
      pages: this.fontPages.map((page) => ({
        prefix: page.prefix,
        emojis: page.emojis.map((emoji) => ({
          code: emoji.code,
          unicode: emoji.unicode,
          imageUri: emoji.imageUri
            ? this.panel!.webview.asWebviewUri(emoji.imageUri).toString()
            : null,
        })),
      })),
    });

    if (this.currentPage < this.fontPages.length) {
      const currentPageData = this.fontPages[this.currentPage];
      this.panel.webview.postMessage({
        command: "updatePageContent",
        currentPage: this.currentPage,
        emojis: currentPageData.emojis.map((emoji) => ({
          ...emoji,
          imageUri: emoji.imageUri
            ? this.panel!.webview.asWebviewUri(emoji.imageUri).toString()
            : null,
        })),
        pageInfo: vscode.l10n.t('emojiPicker.pageInfo', 
          this.currentPage + 1, 
          this.fontPages.length, 
          currentPageData.filename, 
          currentPageData.emojis.length),
      });
    }
  }

  private async insertEmoji(unicode: string) {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      await vscode.window.showTextDocument(editor.document, editor.viewColumn);

      const position = editor.selection.active;
      const success = await editor.edit((editBuilder) => {
        editBuilder.insert(position, unicode);
      });

      if (success) {
        vscode.window.showInformationMessage(vscode.l10n.t('emojiPicker.inserted', unicode));
      } else {
        vscode.window.showErrorMessage(vscode.l10n.t('emojiPicker.error.insert'));
        console.error("EmojiPicker: Error inserting emoji");
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t('emojiPicker.error.noActiveEditor'));
      console.error("EmojiPicker: No active editor for insertion");
    }
  }

  private async copyToClipboard(text: string) {
    await vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage(vscode.l10n.t('emojiPicker.copied', text));
  }

  dispose() {
    if (this.panel) {
      this.panel.dispose();
    }
  }
}