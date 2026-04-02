const { spawn } = require('child_process');
const path = require('path');

// Usa o build de produção (dist/) em vez de start:dev — sem abrir janela CMD
const child = spawn(process.execPath, ['dist/src/main'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
  windowsHide: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
