'use strict';

const parseArrayParam = (value) => {
  if (value === undefined || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => (entry === undefined || entry === null ? null : String(entry)))
      .filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const normalizeBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  return defaultValue;
};

const toLowerList = (values) => parseArrayParam(values).map((value) => value.toLowerCase());

module.exports = {
  parseArrayParam,
  normalizeBoolean,
  toLowerList,
};
