import { rm } from 'fs/promises';
import { join } from 'path';

async function clean() {
  const buildDir = join(process.cwd(), 'dist');
  try {
    await rm(buildDir, { recursive: true, force: true });
    console.log('Successfully cleaned build directory "dist/".');
  } catch (err) {
    console.error('Failed to clean build directory:', err);
  }
}

clean();
