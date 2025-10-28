'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class LegalConsent extends Model {
    static associate(models) {
      this.belongsTo(models.LegalDocument, { foreignKey: 'document_id', as: 'document' });
      this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  const jsonType = sequelize.getDialect() === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

  LegalConsent.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      document_id: { type: DataTypes.UUID, allowNull: false },
      document_slug: { type: DataTypes.STRING, allowNull: false },
      document_version: { type: DataTypes.STRING, allowNull: false },
      ip_address: DataTypes.STRING,
      user_agent: DataTypes.STRING,
      metadata: { type: jsonType },
      consented_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      revoked_at: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: 'LegalConsent',
      tableName: 'legal_consents',
      paranoid: true,
    }
  );

  return LegalConsent;
};
