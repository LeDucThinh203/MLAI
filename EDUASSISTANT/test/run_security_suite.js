const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const testArgs = ['-m', 'unittest', 'discover', '-s', 'test', '-p', 'test_*.py', '-v'];
const localVenvPython = process.platform === 'win32'
  ? path.join(projectRoot, '.venv', 'Scripts', 'python.exe')
  : path.join(projectRoot, '.venv', 'bin', 'python');
const candidates = process.env.PYTHON
  ? [{ command: process.env.PYTHON, args: testArgs }]
  : [
      ...(fs.existsSync(localVenvPython) ? [{ command: localVenvPython, args: testArgs }] : []),
      ...(process.platform === 'win32'
        ? [{ command: 'py', args: ['-3', ...testArgs] }, { command: 'python', args: testArgs }]
        : [{ command: 'python3', args: testArgs }, { command: 'python', args: testArgs }]),
    ];

for (const candidate of candidates) {
  const result = spawnSync(candidate.command, candidate.args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      AI_MODE: 'mock',
      DATABASE_URL: '',
      GEMINI_API_KEY: '',
      OPENROUTER_API_KEY: '',
    },
  });
  if (!result.error) {
    process.exitCode = result.status ?? 1;
    process.exit();
  }
  if (result.error.code !== 'ENOENT') {
    console.error(result.error.message);
    process.exit(1);
  }
}

console.error('Python was not found. Install Python and backend dependencies before running npm test.');
process.exit(1);
