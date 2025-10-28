'use strict';

const ENUM_DIALECTS = new Set(['postgres', 'mysql', 'mariadb']);

const jsonColumn = (sequelize, DataTypes, options = {}) => {
  const dialect = sequelize.getDialect();
  const type = dialect === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;
  return { ...options, type };
};

const enumColumn = (sequelize, DataTypes, values, options = {}) => {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('enumColumn requires a non-empty array of values');
  }
  const dialect = sequelize.getDialect();
  const supportsEnum = ENUM_DIALECTS.has(dialect);
  const column = {
    ...options,
    type: supportsEnum ? DataTypes.ENUM(...values) : DataTypes.STRING,
  };

  if (!supportsEnum) {
    column.validate = {
      ...(options.validate || {}),
      isIn: [values],
    };
  }

  if (options.defaultValue && !values.includes(options.defaultValue)) {
    throw new Error(`Default value "${options.defaultValue}" is not part of enum values`);
  }

  return column;
};

module.exports = { jsonColumn, enumColumn };
