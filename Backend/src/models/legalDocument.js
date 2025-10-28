'use strict';

const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class LegalDocument extends Model {
    static associate(models) {
      this.hasMany(models.LegalConsent, { foreignKey: 'document_id', as: 'consents' });
    }
  }

  const jsonType = sequelize.getDialect() === 'postgres' ? DataTypes.JSONB : DataTypes.JSON;

  LegalDocument.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      slug: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      summary: DataTypes.TEXT,
      content: { type: DataTypes.TEXT, allowNull: false },
      version: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'published' },
      effective_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      published_at: DataTypes.DATE,
      metadata: { type: jsonType },
    },
    {
      sequelize,
      modelName: 'LegalDocument',
      tableName: 'legal_documents',
      paranoid: true,
      defaultScope: {
        attributes: { exclude: ['deleted_at'] },
        order: [
          ['effective_at', 'DESC'],
          ['created_at', 'DESC'],
        ],
      },
    }
  );

  return LegalDocument;
};
