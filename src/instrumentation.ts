export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { scanMangaDirectory } = await import('./lib/scanner');
    scanMangaDirectory();
  }
}
