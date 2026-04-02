module.exports = {
  apps: [
    {
      name: 'cooperebr-whatsapp',
      script: 'index.mjs',
      cwd: 'C:/Users/Luciano/cooperebr/whatsapp-service',
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
      autorestart: true,
      max_restarts: 5,
      min_uptime: '60s',
      restart_delay: 8000,
      env: { NODE_ENV: 'development' },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'C:/Users/Luciano/cooperebr/logs/nest-error.log',
      out_file: 'C:/Users/Luciano/cooperebr/logs/nest-out.log',
      merge_logs: true
    }
  ]
}
