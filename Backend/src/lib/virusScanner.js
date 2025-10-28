const fs = require('fs/promises');
const crypto = require('crypto');
const { FileAsset } = require('../models');
const fileStorage = require('./fileStorage');

const SIGNATURES = [
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
  "<script>alert(",
];

const hashBuffer = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const inspectBuffer = (buffer) => {
  const contents = buffer.toString('utf8');
  const matched = SIGNATURES.find((signature) => contents.includes(signature));
  return {
    matchedSignature: matched || null,
    hash: hashBuffer(buffer),
  };
};

const scheduleScan = (fileId) => {
  setImmediate(async () => {
    const file = await FileAsset.findByPk(fileId, { paranoid: false });
    if (!file) {
      return;
    }
    try {
      const buffer = await fs.readFile(fileStorage.resolvePath(file.storage_key));
      const result = inspectBuffer(buffer);
      if (result.matchedSignature) {
        await file.update({
          status: 'blocked',
          metadata: {
            ...(file.metadata || {}),
            scan: {
              status: 'blocked',
              reason: 'signature_match',
              signature: result.matchedSignature,
              hash: result.hash,
              scanned_at: new Date().toISOString(),
            },
          },
        });
        return;
      }
      await file.update({
        status: 'ready',
        scanned_at: new Date(),
        metadata: {
          ...(file.metadata || {}),
          scan: {
            status: 'ready',
            hash: result.hash,
            scanned_at: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      await file.update({
        status: 'blocked',
        metadata: {
          ...(file.metadata || {}),
          scan: {
            status: 'error',
            message: error.message,
            scanned_at: new Date().toISOString(),
          },
        },
      });
    }
  });
};

module.exports = { scheduleScan };
