const { kebabCase } = require('lodash');
const { v4: uuid } = require('uuid');

const createSlug = (value) => {
  if (!value) {
    return uuid();
  }
  const base = kebabCase(String(value));
  if (!base) {
    return uuid();
  }
  return base.slice(0, 60);
};

const ensureUniqueSlug = async (model, desired, { field = 'slug', transaction } = {}) => {
  const base = desired || uuid();
  let candidate = base;
  let suffix = 1;
  // Loop until we find an unused slug variant
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await model.findOne({
      where: { [field]: candidate },
      paranoid: false,
      transaction,
    });
    if (!existing) {
      return candidate;
    }
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
};

module.exports = { createSlug, ensureUniqueSlug };
