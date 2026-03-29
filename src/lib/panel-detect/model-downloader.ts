import fs from 'fs';
import path from 'path';
import https from 'https';

const MODEL_URL =
  'https://huggingface.co/deepghs/manga109_yolo/resolve/main/v2023.12.07_s_yv11/model.onnx';

const MODELS_DIR = path.resolve(process.cwd(), 'models');
const MODEL_PATH = path.join(MODELS_DIR, 'manga109_yolo_small.onnx');

export function getModelPath(): string {
  return MODEL_PATH;
}

export function isModelDownloaded(): boolean {
  return fs.existsSync(MODEL_PATH);
}

function followRedirects(url: string, dest: fs.WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        const location = res.headers.location;
        if (!location) return reject(new Error('Redirect with no location header'));
        res.resume();
        followRedirects(location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Download failed with status ${res.statusCode}`));
      }
      res.pipe(dest);
      dest.on('finish', () => {
        dest.close();
        resolve();
      });
      dest.on('error', reject);
      res.on('error', reject);
    }).on('error', reject);
  });
}

export async function downloadModel(): Promise<string> {
  if (isModelDownloaded()) return MODEL_PATH;

  fs.mkdirSync(MODELS_DIR, { recursive: true });

  const tmpPath = MODEL_PATH + '.tmp';
  const dest = fs.createWriteStream(tmpPath);

  try {
    await followRedirects(MODEL_URL, dest);
    fs.renameSync(tmpPath, MODEL_PATH);
    return MODEL_PATH;
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}
