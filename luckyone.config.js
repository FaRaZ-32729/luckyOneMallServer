module.exports = {
  apps: [
    {
      name: "luckyoneserver",
      script: "server.js",
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "luckyoneworker",
      script: "src/utils/scheduleWorker.js",
      watch: false,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};