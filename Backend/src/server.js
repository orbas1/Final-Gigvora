const http = require('http');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const { initRealtime } = require('./lib/realtime');

const server = http.createServer(app);

const start = async () => {
  try {
    await sequelize.authenticate();
    if (config.database?.autoMigrate) {
      await sequelize.sync();
    }
    initRealtime(server, { origins: config.http?.cors?.origins });
    server.listen(config.port, () => {
      console.log(`Server listening on port ${config.port}`);
    });
  } catch (error) {
    console.error('Unable to start server', error);
    process.exit(1);
  }
};

start();
