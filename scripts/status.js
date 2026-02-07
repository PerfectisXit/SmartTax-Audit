const { execSync } = require('child_process');

const checkPort = (port) => {
  try {
    const out = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (!out) return { port, ok: false };
    return { port, ok: true, detail: out.split('\n').slice(1).join('\n') };
  } catch {
    return { port, ok: false };
  }
};

const ports = [3001, 5173, 5174, 5175];
const results = ports.map(checkPort);

console.log('SmartTax status:');
results.forEach((r) => {
  if (r.ok) {
    console.log(`- ${r.port}: RUNNING`);
    if (r.detail) console.log(r.detail);
  } else {
    console.log(`- ${r.port}: STOPPED`);
  }
});
