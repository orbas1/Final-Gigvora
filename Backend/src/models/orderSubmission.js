'use strict';

const { Model, DataTypes } = require('sequelize');
const { getJsonType } = require('../utils/sequelize');

module.exports = (sequelize) => {
  const jsonType = getJsonType(sequelize, DataTypes);
  class OrderSubmission extends Model {
    static associate(models) {
      this.belongsTo(models.GigOrder, { foreignKey: 'order_id', as: 'order' });
      this.belongsTo(models.User, { foreignKey: 'submitter_id', as: 'submitter' });
    }
  }

  OrderSubmission.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      order_id: { type: DataTypes.UUID, allowNull: false },
      submitter_id: { type: DataTypes.UUID, allowNull: false },
      message: DataTypes.TEXT,
      attachments: jsonType,
      status: {
        type: DataTypes.ENUM('submitted', 'revision_requested', 'accepted'),
        allowNull: false,
        defaultValue: 'submitted',
      },
      submitted_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      responded_at: DataTypes.DATE,
      metadata: jsonType,
      deleted_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'OrderSubmission',
      tableName: 'order_submissions',
      underscored: true,
      paranoid: true,
    }
  );

  return OrderSubmission;
};
