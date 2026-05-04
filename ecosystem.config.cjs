module.exports = {
  apps: [
    {
      name: 'cooperebr-whatsapp',
      script: 'index.mjs',
      cwd: 'C:/Users/Luciano/cooperebr/whatsapp-service',
      node_args: '--env-file=.env',
      watch: false,
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      restart_delay: 8000,
      env: {
        PORT: 3002,
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'C:/Users/Luciano/cooperebr/logs/wa-error.log',
      out_file: 'C:/Users/Luciano/cooperebr/logs/wa-out.log',
      merge_logs: true
    },
    {
      name: 'cooperebr-backend',
      script: 'pm2-start.js',
      cwd: 'C:/Users/Luciano/cooperebr/backend',
      watch: false,
      instances: 1,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '60s',
      exp_backoff_restart_delay: 1000,
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 30000,
      shutdown_with_message: true,
      env: { NODE_ENV: 'production' },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'C:/Users/Luciano/cooperebr/logs/nest-error.log',
      out_file: 'C:/Users/Luciano/cooperebr/logs/nest-out.log',
      merge_logs: true
    }
    ,
    {
      name: 'cooperebr-frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      cwd: 'C:/Users/Luciano/cooperebr/web',
      watch: false,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      max_memory_restart: '512M',
      kill_timeout: 8000,
      env: { NODE_ENV: 'production', PORT: 3001 },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'C:/Users/Luciano/cooperebr/logs/next-error.log',
      out_file: 'C:/Users/Luciano/cooperebr/logs/next-out.log',
      merge_logs: true
    }
  ]
}
