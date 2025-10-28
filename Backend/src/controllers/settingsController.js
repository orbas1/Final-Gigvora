const settingsService = require('../services/settingsService');

const getAccount = async (req, res, next) => {
  try {
    const account = await settingsService.getAccount(req.user.id);
    res.json(account);
  } catch (error) {
    next(error);
  }
};

const updateAccount = async (req, res, next) => {
  try {
    const account = await settingsService.updateAccount(req.user.id, req.body);
    res.json(account);
  } catch (error) {
    next(error);
  }
};

const getSection = async (req, res, next) => {
  try {
    const settings = await settingsService.getSettings(req.user.id);
    res.json(settings[req.params.section] || {});
  } catch (error) {
    next(error);
  }
};

const updateSection = async (req, res, next) => {
  try {
    const value = await settingsService.updateSettingsSection(req.user.id, req.params.section, req.body);
    res.json(value);
  } catch (error) {
    next(error);
  }
};

module.exports = { getAccount, updateAccount, getSection, updateSection };
