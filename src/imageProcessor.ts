import * as vscode from "vscode";
import sharp from "sharp";
import * as path from "path";
import * as fs from "fs";

export class ImageProcessor {
  private cache: Map<string, vscode.Uri> = new Map();
  private processingCache: Map<string, Promise<vscode.Uri | null>> = new Map();
  private cacheDir: string;
  private readonly MAX_HEIGHT = 14;

  constructor(private context: vscode.ExtensionContext) {
    this.cacheDir = path.join(context.globalStorageUri.fsPath, "glyphCache");
    this.ensureCacheDir();
  }

  private ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async extractGlyphImage(
    pngPath: string,
    row: number,
    col: number,
    fontCode: string
  ): Promise<vscode.Uri | null> {
    const cacheKey = `${path.basename(pngPath)}_${row}_${col}_v2`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (this.processingCache.has(cacheKey)) {
      return this.processingCache.get(cacheKey)!;
    }

    const processingPromise = this.processImage(pngPath, row, col, cacheKey);
    this.processingCache.set(cacheKey, processingPromise);

    try {
      const result = await processingPromise;
      this.processingCache.delete(cacheKey);
      if (result) {
        this.cache.set(cacheKey, result);
      }
      return result;
    } catch (error) {
      this.processingCache.delete(cacheKey);
      throw error;
    }
  }

  private async processImage(
    pngPath: string,
    row: number,
    col: number,
    cacheKey: string
  ): Promise<vscode.Uri | null> {
    try {
      const cachePath = path.join(this.cacheDir, `${cacheKey}.png`);
      if (fs.existsSync(cachePath)) {
        return vscode.Uri.file(cachePath);
      }

      const originalImage = sharp(pngPath);
      const metadata = await originalImage.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error("Не вдалося отримати розміри зображення");
      }

      const cellWidth = Math.floor(metadata.width / 16);
      const cellHeight = Math.floor(metadata.height / 16);

      const left = col * cellWidth;
      const top = row * cellHeight;

      const extractedBuffer = await originalImage
        .extract({
          left,
          top,
          width: cellWidth,
          height: cellHeight,
        })
        .png()
        .toBuffer();

      const isTransparent = await this.isImageTransparent(extractedBuffer);
      if (isTransparent) {
        return null;
      }

      const processedBuffer = await this.trimAndOptimizeImage(extractedBuffer);
      if (!processedBuffer) {
        return null;
      }

      await fs.promises.writeFile(cachePath, processedBuffer);

      return vscode.Uri.file(cachePath);
    } catch (error) {
      console.error(`Помилка обробки зображення ${pngPath}:`, error);
      return null;
    }
  }

  private async trimAndOptimizeImage(buffer: Buffer): Promise<Buffer | null> {
    try {
      const image = sharp(buffer);

      const { data, info } = await image
        .raw()
        .toBuffer({ resolveWithObject: true });

      if (info.channels < 4) {
        return await this.scaleToMaxHeight(buffer);
      }

      const bounds = this.findNonTransparentBounds(
        data,
        info.width,
        info.height,
        info.channels
      );

      if (!bounds) {
        return null;
      }

      const trimmedBuffer = await image
        .extract({
          left: bounds.minX,
          top: bounds.minY,
          width: bounds.width,
          height: bounds.height,
        })
        .png()
        .toBuffer();

      if (bounds.height > this.MAX_HEIGHT) {
        return await this.scaleToMaxHeight(trimmedBuffer);
      }

      return trimmedBuffer;
    } catch (error) {
      console.error("Помилка обрізання зображення:", error);
      return await this.scaleToMaxHeight(buffer);
    }
  }

  private findNonTransparentBounds(
    data: Buffer,
    width: number,
    height: number,
    channels: number
  ): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  } | null {
    let minX = width,
      maxX = -1;
    let minY = height,
      maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alphaIndex = (y * width + x) * channels + 3;
        if (data[alphaIndex] > 0) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX === -1) {
      return null;
    }

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  private async scaleToMaxHeight(buffer: Buffer): Promise<Buffer> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        return buffer;
      }

      if (metadata.height <= this.MAX_HEIGHT) {
        return buffer;
      }

      const aspectRatio = metadata.width / metadata.height;
      const newWidth = Math.round(this.MAX_HEIGHT * aspectRatio);

      return await image
        .resize(newWidth, this.MAX_HEIGHT, {
          kernel: sharp.kernel.lanczos3,
          fit: "fill",
        })
        .png({
          compressionLevel: 6,
          palette: true,
        })
        .toBuffer();
    } catch (error) {
      console.error("Помилка масштабування зображення:", error);
      return buffer;
    }
  }

  private async isImageTransparent(buffer: Buffer): Promise<boolean> {
    try {
      const image = sharp(buffer);
      const { data, info } = await image
        .raw()
        .toBuffer({ resolveWithObject: true });

      if (info.channels < 4) {
        return false;
      }

      const step = Math.max(1, Math.floor(data.length / (4 * 100)));
      for (let i = 3; i < data.length; i += 4 * step) {
        if (data[i] > 10) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("Помилка перевірки прозорості:", error);
      return false;
    }
  }

  async clearOldCache(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.cacheDir);
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.promises.stat(filePath);

        if (stats.mtime.getTime() < oneWeekAgo) {
          await fs.promises.unlink(filePath);
        }
      }
    } catch (error) {
      console.error("Помилка очищення кешу:", error);
    }
  }

  dispose() {
    this.cache.clear();
    this.processingCache.clear();

    this.clearOldCache().catch(console.error);
  }
}
