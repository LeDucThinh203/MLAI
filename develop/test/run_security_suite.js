const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const projectRoot = path.resolve(__dirname, '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'caseflow-security-test-'));

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function runNodeScript(scriptPath, env, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd: projectRoot,
      env,
      stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe']
    });

    let output = '';
    if (!options.inherit) {
      child.stdout.on('data', chunk => { output += chunk.toString(); process.stdout.write(chunk); });
      child.stderr.on('data', chunk => { output += chunk.toString(); process.stderr.write(chunk); });
    }
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve({ child, output });
      else reject(new Error(`${scriptPath} exited with ${signal || code}\n${output}`));
    });
  });
}

async function waitForServer(server, baseUrl) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Backend exited during startup (${server.exitCode}).`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Backend did not become ready within 30 seconds.');
}

async function main() {
  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DATA_DIR: dataDir,
    AI_MODE: 'mock',
    GEMINI_API_KEY: '',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    REFRESH_SECRET: crypto.randomBytes(32).toString('hex'),
    SIGNATURE_KEY: crypto.randomBytes(32).toString('hex'),
    TEST_BASE_URL: baseUrl
  };

  const server = spawn(process.execPath, ['Part1_JWT_Auth/backend/server.js'], {
    cwd: projectRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  server.stdout.on('data', chunk => process.stdout.write(`[backend] ${chunk}`));
  server.stderr.on('data', chunk => process.stderr.write(`[backend] ${chunk}`));

  try {
    await waitForServer(server, baseUrl);
    const test = await runNodeScript('test/security_and_system.test.js', env, { inherit: true });
    if (test.child.exitCode !== 0) process.exitCode = test.child.exitCode || 1;
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await new Promise(resolve => {
        if (server.exitCode !== null) return resolve();
        const timer = setTimeout(() => {
          if (server.exitCode === null) server.kill('SIGKILL');
          resolve();
        }, 5000);
        server.once('exit', () => { clearTimeout(timer); resolve(); });
      });
    }
    const resolvedDataDir = path.resolve(dataDir);
    if (!resolvedDataDir.startsWith(path.resolve(os.tmpdir()) + path.sep)) {
      throw new Error('Refusing to remove test data outside the OS temp directory.');
    }
    fs.rmSync(resolvedDataDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
