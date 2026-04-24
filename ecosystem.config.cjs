module.exports = {
  apps: [
    {
      name: 'oci-visualizer',
      script: 'dist/index.js',
      cwd: './server',
      node_args: '--max-old-space-size=4096',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        DATABASE_URL: process.env.DATABASE_URL || '',
      },
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      // Logging
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      // Watch (disabled in prod — use deploy script to restart)
      watch: false,
    },
  ],
};
