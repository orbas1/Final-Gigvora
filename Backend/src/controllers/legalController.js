const terms = 'Terms and conditions placeholder.';
const privacy = 'Privacy policy placeholder.';
const refunds = 'Refund policy placeholder.';
const guidelines = 'Community guidelines placeholder.';

const getTerms = (req, res) => res.json({ content: terms });
const getPrivacy = (req, res) => res.json({ content: privacy });
const getRefunds = (req, res) => res.json({ content: refunds });
const getGuidelines = (req, res) => res.json({ content: guidelines });

const consentLogs = [];

const listConsents = (req, res) => res.json({ data: consentLogs });
const createConsent = (req, res) => {
  const consent = { ...req.body, id: consentLogs.length + 1, created_at: new Date() };
  consentLogs.push(consent);
  res.status(201).json(consent);
};
const getConsent = (req, res) => {
  const consent = consentLogs.find((c) => c.id === Number(req.params.id));
  if (!consent) return res.status(404).json({ message: 'Not found' });
  res.json(consent);
};

module.exports = { getTerms, getPrivacy, getRefunds, getGuidelines, listConsents, createConsent, getConsent };
