'use strict';

const { Model, DataTypes } = require('sequelize');
const { v4: uuid } = require('uuid');
const { jsonColumn, enumColumn } = require('./helpers/columnTypes');

module.exports = (sequelize) => {
  class GigSubmission extends Model {
    static associate(models) {
      this.belongsTo(models.GigOrder, { foreignKey: 'order_id', as: 'order' });
      this.belongsTo(models.User, { foreignKey: 'submitted_by', as: 'submitter' });
    }
  }

  GigSubmission.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: () => uuid(),
        primaryKey: true,
      },
      order_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      submitted_by: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      attachments: jsonColumn(sequelize, DataTypes, { allowNull: true }),
      status: enumColumn(sequelize, DataTypes, ['submitted', 'revision_requested', 'resubmitted', 'accepted'], {
        allowNull: false,
        defaultValue: 'submitted',
      }),
      revision_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'GigSubmission',
      tableName: 'gig_submissions',
      paranoid: true,
      indexes: [
        { fields: ['order_id'] },
        { fields: ['submitted_by'] },
      ],
    }
  );

  return GigSubmission;
};
