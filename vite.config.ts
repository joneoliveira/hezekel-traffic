import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';

const now = new Date();
const buildStamp = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;

let commitCount = '0';
try {
  const c = execSync('git rev-list --count HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
  if (parseInt(c) > 0) commitCount = c;
} catch {
  // not a git repo or git unavailable
}
// Vercel builds without full git history: derive a stable pseudo-patch from the commit SHA
if (commitCount === '0' && process.env.VERCEL_GIT_COMMIT_SHA) {
  commitCount = String(parseInt(process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8), 16) % 10000);
}

const majorMinor = process.env.npm_package_version ?? '1.0';
const appVersion = `${majorMinor}.${commitCount}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_STAMP__: JSON.stringify(buildStamp),
  },
});
