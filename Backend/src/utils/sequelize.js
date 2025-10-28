'use strict';

const parseJson = (value) => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }

  return value;
};

const jsonField = (sequelize, DataTypes, fieldName, options = {}) => {
  const dialect = sequelize.getDialect();
  const type = dialect === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;
  const isSqlite = dialect === 'sqlite';
  const allowNull = options.allowNull !== undefined ? options.allowNull : true;
  const defaultValue = options.defaultValue !== undefined ? options.defaultValue : null;

  return {
    type,
    allowNull,
    defaultValue,
    get() {
      const rawValue = this.getDataValue(fieldName);
      return parseJson(rawValue);
    },
    set(value) {
      if (value === undefined) {
        this.setDataValue(fieldName, null);
        return;
      }

      if (value === null) {
        this.setDataValue(fieldName, null);
        return;
      }

      if (isSqlite && typeof value !== 'string') {
        this.setDataValue(fieldName, JSON.stringify(value));
        return;
      }

      this.setDataValue(fieldName, value);
    },
  };
};

module.exports = { jsonField, parseJson };
