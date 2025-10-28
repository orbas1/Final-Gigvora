'use strict';

const { Model, DataTypes } = require('sequelize');
const { getJsonType } = require('../utils/sequelize');

module.exports = (sequelize) => {
  const jsonType = getJsonType(sequelize, DataTypes);
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
      metadata: jsonType,
      scanned_at: DataTypes.DATE,
      status: {
        type: DataTypes.ENUM('pending', 'ready', 'blocked'),
        defaultValue: 'pending',
      },
    },
    {
      sequelize,
      modelName: 'FileAsset',
      tableName: 'files',
    }
  );

  return FileAsset;
};
