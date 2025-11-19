import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MODEL_DIR = path.resolve('model');
const OUTPUT_FILE = path.resolve('data/models.json');
const THUMBNAIL_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.avif'];

async function main() {
  try {
    const manifest = await buildManifest();
    await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    await writeFile(OUTPUT_FILE, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`[WaytoAR] 已更新 ${manifest.total} 筆模型 -> ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  } catch (error) {
    console.error('[WaytoAR] 產生模型清單失敗：', error.message);
    process.exitCode = 1;
  }
}

async function buildManifest() {
  const dirEntries = await safeReadDir(MODEL_DIR);
  const fileNames = dirEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const fileSet = new Set(fileNames);

  const models = [];

  for (const fileName of fileNames) {
    if (path.extname(fileName).toLowerCase() !== '.usdz') continue;

    const baseName = path.basename(fileName, path.extname(fileName));
    const modelPath = path.join('model', fileName);
    const absoluteModelPath = path.join(MODEL_DIR, fileName);
    const fileStats = await stat(absoluteModelPath);
    const thumbnail = findThumbnail(baseName, fileSet);

    if (!thumbnail) {
      console.warn(`[WaytoAR] 找不到 ${fileName} 對應的縮圖，將以預設樣式呈現。`);
    }

    models.push({
      id: baseName,
      displayName: prettifyName(baseName),
      fileName,
      modelPath: toPosix(modelPath),
      thumbnailPath: thumbnail ? toPosix(path.join('model', thumbnail)) : null,
      size: {
        bytes: fileStats.size,
        humanReadable: formatFileSize(fileStats.size),
      },
      updatedAt: fileStats.mtime.toISOString(),
    });
  }

  models.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-Hant-u-co-stroke'));

  return {
    generatedAt: new Date().toISOString(),
    total: models.length,
    items: models,
  };
}

async function safeReadDir(target) {
  try {
    return await readdir(target, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`找不到模型資料夾：${target}`);
    }
    throw error;
  }
}

function findThumbnail(baseName, fileSet) {
  for (const ext of THUMBNAIL_EXTENSIONS) {
    const candidate = `${baseName}${ext}`;
    if (fileSet.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function prettifyName(input) {
  return input
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

main();

