/* eslint-disable no-undef */
import { execSync } from 'child_process';
import { rmSync, mkdirSync, cpSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_URL = '/demos/cr-26/spa';
const PORT = 8080;

console.log('\n🔨 Building production bundle...\n');

try {
  execSync('tsc --noEmit && cross-env NODE_ENV=production parcel build ./index.html --public-url ./', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });

  console.log('\n📦 Setting up production directory structure...\n');

  const distServe = path.resolve(__dirname, '../dist-serve');
  const targetDir = path.resolve(distServe, 'demos/cr-26/spa');

  if (existsSync(distServe)) {
    rmSync(distServe, { recursive: true, force: true });
  }

  mkdirSync(targetDir, { recursive: true });

  cpSync(
    path.resolve(__dirname, '../dist'),
    targetDir,
    { recursive: true }
  );

  console.log('✅ Production build complete!\n');
  console.log('🚀 To serve the production build, run:\n');
  console.log(`   http-server dist-serve -p ${PORT}\n`);
  console.log('📍 Then navigate to:\n');
  console.log(`   http://localhost:${PORT}${PUBLIC_URL}/\n`);

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

