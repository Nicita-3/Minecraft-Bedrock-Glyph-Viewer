import * as vscode from "vscode";
import sharp from "sharp";
import * as path from "path";
import * as fs from "fs";

const config = vscode.workspace.getConfiguration('glyphViewer');

export class ImageProcessor {
  private cache: Map<string, vscode.Uri> = new Map();
  private processingCache: Map<string, Promise<vscode.Uri | null>> = new Map();
  private cacheDir: string;
  private readonly MAX_HEIGHT = config.get<number>('maxHeight') ?? 14;
  private readonly HOVER_MIN_SIZE = config.get<number>('hoverMinSize') ?? 32;
  private readonly HOVER_MAX_SIZE = config.get<number>('hoverMaxSize') ?? 64;

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
    fontCode: string,
    isForHover: boolean = false
  ): Promise<vscode.Uri | null> {
    const suffix = isForHover ? "_hover" : "_inline";
    const cacheKey = `${path.basename(pngPath)}_${row}_${col}${suffix}_v3`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    if (this.processingCache.has(cacheKey)) {
      return this.processingCache.get(cacheKey)!;
    }

    const processingPromise = this.processImage(pngPath, row, col, cacheKey, isForHover);
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
    cacheKey: string,
    isForHover: boolean
  ): Promise<vscode.Uri | null> {
    try {
      const cachePath = path.join(this.cacheDir, `${cacheKey}.png`);
      if (fs.existsSync(cachePath)) {
        return vscode.Uri.file(cachePath);
      }

      const originalImage = sharp(pngPath);
      const metadata = await originalImage.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error(vscode.l10n.t('imageProcessor.imageDimensionsError'));
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

      const processedBuffer = await this.trimAndOptimizeImage(extractedBuffer, isForHover);
      if (!processedBuffer) {
        return null;
      }

      await fs.promises.writeFile(cachePath, processedBuffer);

      return vscode.Uri.file(cachePath);
    } catch (error) {
      console.error(vscode.l10n.t('imageProcessor.imageProcessingError', pngPath), error);
      return null;
    }
  }

  private async trimAndOptimizeImage(buffer: Buffer, isForHover: boolean): Promise<Buffer | null> {
    try {
      const image = sharp(buffer);

      const { data, info } = await image
        .raw()
        .toBuffer({ resolveWithObject: true });

      if (info.channels < 4) {
        return await this.scaleImage(buffer, isForHover);
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

      return await this.scaleImage(trimmedBuffer, isForHover);
    } catch (error) {
      console.error(vscode.l10n.t('imageProcessor.imageTrimError'), error);
      return await this.scaleImage(buffer, isForHover);
    }
  }

  private async scaleImage(buffer: Buffer, isForHover: boolean): Promise<Buffer> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        return buffer;
      }

      let targetHeight: number;
      let targetWidth: number;

      if (isForHover) {
        if (Math.max(metadata.width, metadata.height) < this.HOVER_MIN_SIZE) {
          const scale = Math.ceil(this.HOVER_MIN_SIZE / Math.max(metadata.width, metadata.height));
          targetWidth = metadata.width * scale;
          targetHeight = metadata.height * scale;
        } else if (Math.max(metadata.width, metadata.height) > this.HOVER_MAX_SIZE) {
          const scale = this.HOVER_MAX_SIZE / Math.max(metadata.width, metadata.height);
          targetWidth = Math.floor(metadata.width * scale);
          targetHeight = Math.floor(metadata.height * scale);
        } else {
          return buffer;
        }
      } else {
        if (metadata.height <= this.MAX_HEIGHT) {
          return buffer;
        }
        const aspectRatio = metadata.width / metadata.height;
        targetHeight = this.MAX_HEIGHT;
        targetWidth = Math.round(this.MAX_HEIGHT * aspectRatio);
      }

      return await image
        .resize(targetWidth, targetHeight, {
          kernel: sharp.kernel.nearest,
          fit: "fill",
        })
        .png({
          compressionLevel: 0,
          palette: false,
        })
        .toBuffer();
    } catch (error) {
      console.error(vscode.l10n.t('imageProcessor.imageScalingError'), error);
      return buffer;
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
    return this.scaleImage(buffer, false);
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
      console.error(vscode.l10n.t('imageProcessor.transparencyCheckError'), error);
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
      console.error(vscode.l10n.t('imageProcessor.cacheClearError'), error);
    }
  }

  dispose() {
    this.cache.clear();
    this.processingCache.clear();

    this.clearOldCache().catch(console.error);
  }
}