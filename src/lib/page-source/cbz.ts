import StreamZip from 'node-stream-zip';
import path from 'path';
import type { PageSource } from './types';
import { isRecognisedImageExtension } from './types';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function isSkippableEntry(name: string): boolean {
  // Apple metadata folder
  if (name.startsWith('__MACOSX/') || name.includes('/__MACOSX/')) return true;
  // Windows thumbnail cache
  const base = path.posix.basename(name);
  if (base === 'Thumbs.db' || base === 'thumbs.db') return true;
  // Comic metadata
  if (base.toLowerCase() === 'comicinfo.xml') return true;
  // Hidden files (any segment starting with .)
  if (name.split('/').some((seg) => seg.startsWith('.'))) return true;
  return false;
}

export class CbzPageSource implements PageSource {
  readonly format = 'cbz' as const;
  private zip: StreamZip.StreamZipAsync | null = null;
  private entryNamesPromise: Promise<string[]> | null = null;

  constructor(private readonly filePath: string) {}

  private getZip(): StreamZip.StreamZipAsync {
    if (!this.zip) {
      this.zip = new StreamZip.async({ file: this.filePath, storeEntries: true });
    }
    return this.zip;
  }

  private async loadEntryNames(): Promise<string[]> {
    if (this.entryNamesPromise) return this.entryNamesPromise;
    this.entryNamesPromise = (async () => {
      let entries: { [name: string]: StreamZip.ZipEntry };
      try {
        entries = await this.getZip().entries();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Could not open CBZ archive (not a ZIP or corrupt): ${message}`);
      }

      const names: string[] = [];
      for (const [name, entry] of Object.entries(entries)) {
        if (entry.encrypted) {
          throw new Error('Encrypted CBZ archives are not supported');
        }
        if (entry.isDirectory) continue;
        if (isSkippableEntry(name)) continue;
        if (!isRecognisedImageExtension(name)) continue;
        names.push(name);
      }

      if (names.length === 0) {
        throw new Error('CBZ archive contains no recognised image entries');
      }

      names.sort(collator.compare);
      return names;
    })();
    return this.entryNamesPromise;
  }

  async countPages(): Promise<number> {
    const names = await this.loadEntryNames();
    return names.length;
  }

  async extractPage(pageNumber: number): Promise<Buffer> {
    const names = await this.loadEntryNames();
    if (pageNumber < 1 || pageNumber > names.length) {
      throw new Error(`Page ${pageNumber} out of range (archive has ${names.length} pages)`);
    }
    const entryName = names[pageNumber - 1];
    return this.getZip().entryData(entryName);
  }

  async close(): Promise<void> {
    if (this.zip) {
      const zip = this.zip;
      this.zip = null;
      this.entryNamesPromise = null;
      try {
        await zip.close();
      } catch {
        /* close failures are non-fatal */
      }
    }
  }
}
