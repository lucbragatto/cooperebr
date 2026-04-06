// PM2 executa este arquivo diretamente — sem spawn de child process.
// Isso garante que PM2 controla o PID real do NestJS,
// evitando processos órfãos e EADDRINUSE no restart.
require('./dist/src/main');
