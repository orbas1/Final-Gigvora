'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class GigFaq extends Model {
    static associate(models) {
      this.belongsTo(models.Gig, { foreignKey: 'gig_id', as: 'gig' });
    }
  }

  GigFaq.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      gig_id: { type: DataTypes.UUID, allowNull: false },
      question: { type: DataTypes.STRING, allowNull: false },
      answer: { type: DataTypes.TEXT, allowNull: false },
      sort_order: DataTypes.INTEGER,
      deleted_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'GigFaq',
      tableName: 'gig_faq',
      underscored: true,
      paranoid: true,
    }
  );

  return GigFaq;
};
