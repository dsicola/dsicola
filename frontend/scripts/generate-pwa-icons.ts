/**
 * Gera ícones PWA (192x192 e 512x512) a partir do favicon.svg.
 * Necessário para o Chrome/Android mostrar "Adicionar ao ecrã inicial".
 *
 * Executar: npx tsx scripts/generate-pwa-icons.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'favicon.svg');

async function generateIcons() {
  try {
    const sharp = await import('sharp');
    const svg = fs.readFileSync(svgPath);

    await sharp.default(svg)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'pwa-192.png'));
    console.log('✓ pwa-192.png criado');

    await sharp.default(svg)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'pwa-512.png'));
    console.log('✓ pwa-512.png criado');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ERR_MODULE_NOT_FOUND' || 
        String(err).includes('sharp')) {
      console.error('Erro: instale sharp com: npm i -D sharp');
      process.exit(1);
    }
    throw err;
  }
}

generateIcons();
