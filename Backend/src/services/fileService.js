const { FileAsset } = require('../models');
const { v4: uuid } = require('uuid');

const createFile = async (userId, body) => {
  const file = await FileAsset.create({
    owner_id: userId,
    filename: body.filename,
    storage_key: body.storage_key || uuid(),
    mime_type: body.mime_type,
    size_bytes: body.size_bytes,
    metadata: body.metadata,
  });
  return file;
};

const getFile = (id) => FileAsset.findByPk(id);

const deleteFile = async (id, userId) => {
  const file = await FileAsset.findOne({ where: { id, owner_id: userId } });
  if (!file) return { success: true };
  await file.destroy();
  return { success: true };
};

const storageAnalytics = async ({ owner_id, from, to }) => {
  const total = await FileAsset.sum('size_bytes', { where: { owner_id } });
  return { total_bytes: total || 0 };
};

module.exports = { createFile, getFile, deleteFile, storageAnalytics };
