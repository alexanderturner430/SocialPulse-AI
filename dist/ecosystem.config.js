module.exports = {
  apps: [
    {
      name: "tensorflow-social",
      script: "mcp-server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: 6350
      }
    }
  ]
};
