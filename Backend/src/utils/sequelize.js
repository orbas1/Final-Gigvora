'use strict';

const getJsonType = (sequelize, DataTypes) => {
  const dialect = typeof sequelize.getDialect === 'function' ? sequelize.getDialect() : null;
  if (dialect === 'postgres' && DataTypes.JSONB) {
    return DataTypes.JSONB;
  }
  return DataTypes.JSON;
};

module.exports = { getJsonType };
