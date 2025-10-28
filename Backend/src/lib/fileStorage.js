const fs = require('fs/promises');
const { createReadStream } = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const root = config.storage?.local?.baseDir || path.resolve(process.cwd(), 'storage/uploads');

const ensureRoot = fs.mkdir(root, { recursive: true }).catch(() => {});

const ensureDirectory = async (filePath) => {
  await ensureRoot;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
};

const resolvePath = (storageKey) => {
  if (!storageKey) {
    throw new Error('storageKey is required');
  }
  const normalized = path.normalize(storageKey).replace(/^([/\\])*?/, '');
  const resolved = path.join(root, normalized);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Invalid storage key');
  }
  return resolved;
};

const saveBuffer = async (storageKey, buffer) => {
  const filePath = resolvePath(storageKey);
  await ensureDirectory(filePath);
  await fs.writeFile(filePath, buffer);
  return filePath;
};

const deleteObject = async (storageKey) => {
  const filePath = resolvePath(storageKey);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

const readFile = async (storageKey) => {
  const filePath = resolvePath(storageKey);
  return fs.readFile(filePath);
};

const getFileStats = async (storageKey) => {
  const filePath = resolvePath(storageKey);
  return fs.stat(filePath);
};

const createStream = (storageKey) => {
  const filePath = resolvePath(storageKey);
  return createReadStream(filePath);
};

const generateStorageKey = (ownerId, filename = '') => {
  const extension = path.extname(filename);
  const randomPart = crypto.randomBytes(16).toString('hex');
  return path.join(ownerId, `${randomPart}${extension}`);
};

module.exports = {
  root,
  saveBuffer,
  deleteObject,
  readFile,
  getFileStats,
  createStream,
  generateStorageKey,
  resolvePath,
};
