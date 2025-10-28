'use strict';

const { Model, DataTypes } = require('sequelize');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class FileAsset extends Model {
    static associate(models) {
      this.belongsTo(models.User, { foreignKey: 'owner_id', as: 'owner' });
    }
  }

  FileAsset.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      owner_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      filename: DataTypes.STRING,
      storage_key: DataTypes.STRING,
      mime_type: DataTypes.STRING,
      size_bytes: DataTypes.INTEGER,
      metadata: jsonColumn(sequelize, DataTypes),
      scanned_at: DataTypes.DATE,
      status: enumColumn(sequelize, DataTypes, ['pending', 'ready', 'blocked'], {
        defaultValue: 'pending',
      }),
    },
    {
      sequelize,
      modelName: 'FileAsset',
      tableName: 'files',
    }
  );

  return FileAsset;
};
