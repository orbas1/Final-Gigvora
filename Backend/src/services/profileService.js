const {
  Profile,
  ProfileExperience,
  ProfileEducation,
  ProfileSkill,
  ProfileTag,
  Skill,
  Tag,
  PortfolioItem,
  Review,
  sequelize,
} = require('../models');
const { ApiError } = require('../middleware/errorHandler');
const reviewService = require('./reviewService');

const getProfile = async (userId) => {
  const profile = await Profile.findOne({
    where: { user_id: userId },
    include: [
      { model: ProfileExperience, as: 'experiences' },
      { model: ProfileEducation, as: 'education' },
      { model: PortfolioItem, as: 'portfolio' },
      { model: Review, as: 'reviews', where: { subject_type: 'profile' }, required: false },
      { model: Skill, as: 'skills' },
      { model: Tag, as: 'tags' },
    ],
  });
  if (!profile) {
    throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  }
  return profile;
};

const updateProfile = async (userId, data) => {
  const profile = await Profile.findOne({ where: { user_id: userId } });
  if (!profile) throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  await profile.update(data);
  return getProfile(userId);
};

const addExperience = async (userId, payload) => {
  const profile = await Profile.findOne({ where: { user_id: userId } });
  if (!profile) throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  return ProfileExperience.create({ ...payload, profile_id: profile.id });
};

const updateExperience = async (profileId, expId, payload) => {
  const exp = await ProfileExperience.findByPk(expId);
  if (!exp) throw new ApiError(404, 'Experience not found', 'EXPERIENCE_NOT_FOUND');
  await exp.update(payload);
  return exp;
};

const deleteExperience = async (expId) => {
  await ProfileExperience.destroy({ where: { id: expId } });
  return { success: true };
};

const addEducation = async (userId, payload) => {
  const profile = await Profile.findOne({ where: { user_id: userId } });
  if (!profile) throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  return ProfileEducation.create({ ...payload, profile_id: profile.id });
};

const updateEducation = async (profileId, eduId, payload) => {
  const edu = await ProfileEducation.findByPk(eduId);
  if (!edu) throw new ApiError(404, 'Education not found', 'EDUCATION_NOT_FOUND');
  await edu.update(payload);
  return edu;
};

const deleteEducation = async (eduId) => {
  await ProfileEducation.destroy({ where: { id: eduId } });
  return { success: true };
};

const upsertSkills = async (profileId, skillNames) => {
  const profile = await Profile.findOne({ where: { user_id: profileId } });
  if (!profile) throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  const skills = await Promise.all(
    skillNames.map(async (name) => {
      const [skill] = await Skill.findOrCreate({ where: { name } });
      await ProfileSkill.findOrCreate({ where: { profile_id: profile.id, skill_id: skill.id } });
      return skill;
    })
  );
  return skills;
};

const removeSkill = async (profileId, skillId) => {
  const profile = await Profile.findOne({ where: { user_id: profileId } });
  if (!profile) throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  await ProfileSkill.destroy({ where: { profile_id: profile.id, skill_id: skillId } });
  return { success: true };
};

const upsertTags = async (profileId, tagNames) => {
  const profile = await Profile.findOne({ where: { user_id: profileId } });
  if (!profile) throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  const tags = await Promise.all(
    tagNames.map(async (name) => {
      const [tag] = await Tag.findOrCreate({ where: { name } });
      await ProfileTag.findOrCreate({ where: { profile_id: profile.id, tag_id: tag.id } });
      return tag;
    })
  );
  return tags;
};

const removeTag = async (profileId, tagId) => {
  const profile = await Profile.findOne({ where: { user_id: profileId } });
  if (!profile) throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  await ProfileTag.destroy({ where: { profile_id: profile.id, tag_id: tagId } });
  return { success: true };
};

const addPortfolioItem = async (profileId, payload) => {
  const profile = await Profile.findOne({ where: { user_id: profileId } });
  if (!profile) throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  return PortfolioItem.create({ ...payload, profile_id: profile.id });
};

const updatePortfolioItem = async (profileId, itemId, payload) => {
  const item = await PortfolioItem.findByPk(itemId);
  if (!item) throw new ApiError(404, 'Portfolio item not found', 'PORTFOLIO_NOT_FOUND');
  await item.update(payload);
  return item;
};

const deletePortfolioItem = async (itemId) => {
  await PortfolioItem.destroy({ where: { id: itemId } });
  return { success: true };
};

const addReview = async (profileUserId, reviewer, payload) => {
  const profile = await Profile.findOne({ where: { user_id: profileUserId } });
  if (!profile) throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  return reviewService.createReview(
    {
      subject_type: 'profile',
      subject_id: profile.id,
      rating: payload.rating,
      comment: payload.comment,
    },
    reviewer
  );
};

const listReviews = async (profileUserId, query, currentUser) => {
  const profile = await Profile.findOne({ where: { user_id: profileUserId } });
  if (!profile) throw new ApiError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
  return reviewService.listReviews(
    {
      ...query,
      subject_type: 'profile',
      subject_id: profile.id,
    },
    currentUser
  );
};

const trafficAnalytics = async ({ id, from, to, by = 'day' }) => {
  return [
    { bucket: from || new Date(), visits: Math.floor(Math.random() * 100) },
    { bucket: to || new Date(), visits: Math.floor(Math.random() * 100) },
  ];
};

const engagementAnalytics = async ({ id }) => {
  const follows = await ProfileSkill.count({ where: { profile_id: id } });
  const reviews = await Review.count({ where: { subject_type: 'profile', subject_id: id } });
  return { follows, reviews };
};

const topProfiles = async ({ metric = 'views', from, to }) => {
  const [results] = await sequelize.query(
    'SELECT id, display_name, 0::int as score FROM profiles ORDER BY updated_at DESC LIMIT 10'
  );
  return results;
};

module.exports = {
  getProfile,
  updateProfile,
  addExperience,
  updateExperience,
  deleteExperience,
  addEducation,
  updateEducation,
  deleteEducation,
  upsertSkills,
  removeSkill,
  upsertTags,
  removeTag,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  addReview,
  listReviews,
  trafficAnalytics,
  engagementAnalytics,
  topProfiles,
};
