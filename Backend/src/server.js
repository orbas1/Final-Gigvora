const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');

const start = async () => {
  try {
    await sequelize.authenticate();
    if (config.database?.autoMigrate) {
      await sequelize.sync();
    }
    app.listen(config.port, () => {
      console.log(`Server listening on port ${config.port}`);
    });
  } catch (error) {
    console.error('Unable to start server', error);
    process.exit(1);
  }
};

start();
