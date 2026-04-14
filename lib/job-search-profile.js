/**
 * Job search + resume builder profile (KV key job_search_profile / data/job-search-profile.json).
 */

function defaultEducationEntry() {
  return {
    degree: '',
    dates: '',
    institution: '',
    location: '',
    bullets: ''
  };
}

function defaultApplicant() {
  return {
    fullName: '',
    email: '',
    phone: '',
    cityState: '',
    linkedIn: '',
    portfolio: ''
  };
}

function defaultSkillsGroups() {
  return {
    technical: '',
    professional: '',
    certifications: '',
    languages: '',
    toolsPlatforms: ''
  };
}

function defaultProfile() {
  return {
    applicant: defaultApplicant(),
    headline: '',
    summary: '',
    keyDetails: [],
    targetSkillsToUse: [],
    locationsPreferred: [],
    roleTypesPreferred: [],
    education: [],
    skillsGroups: defaultSkillsGroups(),
    additionalExperienceNotes: '',
    resumeNotesForAi: '',
    resumeIncludedExperienceIds: null,
    resumeIncludedProjectIds: null
  };
}

/**
 * @param {unknown} raw
 * @returns {object}
 */
function mergeProfile(raw) {
  const d = defaultProfile();
  if (!raw || typeof raw !== 'object') return d;

  const app = raw.applicant && typeof raw.applicant === 'object' ? raw.applicant : {};
  d.applicant = {
    ...defaultApplicant(),
    fullName: String(app.fullName != null ? app.fullName : '').trim(),
    email: String(app.email != null ? app.email : '').trim(),
    phone: String(app.phone != null ? app.phone : '').trim(),
    cityState: String(app.cityState != null ? app.cityState : '').trim(),
    linkedIn: String(app.linkedIn != null ? app.linkedIn : '').trim(),
    portfolio: String(app.portfolio != null ? app.portfolio : '').trim()
  };

  d.headline = String(raw.headline != null ? raw.headline : '').trim();
  d.summary = String(raw.summary != null ? raw.summary : '').trim();
  d.keyDetails = Array.isArray(raw.keyDetails) ? raw.keyDetails.map(x => String(x || '').trim()).filter(Boolean) : [];
  d.targetSkillsToUse = Array.isArray(raw.targetSkillsToUse)
    ? raw.targetSkillsToUse.map(x => String(x || '').trim()).filter(Boolean)
    : [];
  d.locationsPreferred = Array.isArray(raw.locationsPreferred)
    ? raw.locationsPreferred.map(x => String(x || '').trim()).filter(Boolean)
    : [];
  d.roleTypesPreferred = Array.isArray(raw.roleTypesPreferred)
    ? raw.roleTypesPreferred.map(x => String(x || '').trim()).filter(Boolean)
    : [];

  const edu = Array.isArray(raw.education) ? raw.education : [];
  d.education = edu.map(function (row) {
    if (!row || typeof row !== 'object') return defaultEducationEntry();
    return {
      degree: String(row.degree != null ? row.degree : '').trim(),
      dates: String(row.dates != null ? row.dates : '').trim(),
      institution: String(row.institution != null ? row.institution : '').trim(),
      location: String(row.location != null ? row.location : '').trim(),
      bullets: String(row.bullets != null ? row.bullets : '').trim()
    };
  });

  const sg = raw.skillsGroups && typeof raw.skillsGroups === 'object' ? raw.skillsGroups : {};
  d.skillsGroups = {
    technical: String(sg.technical != null ? sg.technical : '').trim(),
    professional: String(sg.professional != null ? sg.professional : '').trim(),
    certifications: String(sg.certifications != null ? sg.certifications : '').trim(),
    languages: String(sg.languages != null ? sg.languages : '').trim(),
    toolsPlatforms: String(sg.toolsPlatforms != null ? sg.toolsPlatforms : '').trim()
  };

  d.additionalExperienceNotes = String(raw.additionalExperienceNotes != null ? raw.additionalExperienceNotes : '').trim();
  d.resumeNotesForAi = String(raw.resumeNotesForAi != null ? raw.resumeNotesForAi : '').trim().slice(0, 8000);

  d.resumeIncludedExperienceIds =
    raw.resumeIncludedExperienceIds === null || raw.resumeIncludedExperienceIds === undefined
      ? null
      : Array.isArray(raw.resumeIncludedExperienceIds)
        ? raw.resumeIncludedExperienceIds.map(id => String(id || '').trim()).filter(Boolean)
        : null;
  d.resumeIncludedProjectIds =
    raw.resumeIncludedProjectIds === null || raw.resumeIncludedProjectIds === undefined
      ? null
      : Array.isArray(raw.resumeIncludedProjectIds)
        ? raw.resumeIncludedProjectIds.map(id => String(id || '').trim()).filter(Boolean)
        : null;

  return d;
}

module.exports = {
  defaultProfile,
  mergeProfile,
  defaultEducationEntry
};
