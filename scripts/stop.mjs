import { execSync } from 'child_process';

const ports = [8095, 3050];

for (const port of ports) {
  try {
    if (process.platform === 'win32') {
      const cmd = `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess"`;
      const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const pids = [...new Set(out.split(/\r?\n/).map((p) => p.trim()).filter(Boolean))];
      for (const pid of pids) {
        if (pid && pid !== '0' && pid !== String(process.pid)) {
          console.log(`Port ${port} is occupied by PID ${pid}. Terminating process tree...`);
          try {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
            console.log(`Successfully killed process tree for PID ${pid}`);
          } catch {}
        }
      }
    } else {
      execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
    }
  } catch (err) {
    console.error(`Error freeing port ${port}:`, err.message);
  }
}

console.log('All servers stopped successfully.');
