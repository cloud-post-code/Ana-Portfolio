/** @param {{ projectType?: string } | null | undefined} item */
function getProjectType(item) {
  return item && item.projectType === 'personal' ? 'personal' : 'client';
}

/** @param {{ projectType?: string } | null | undefined} item */
function projectTypeLabel(item) {
  return getProjectType(item) === 'personal' ? 'Personal project' : 'Client project';
}

/** @param {{ projectType?: string } | null | undefined} item */
function projectSectionHash(item) {
  return getProjectType(item) === 'personal' ? '#personal-projects' : '#client-projects';
}

module.exports = { getProjectType, projectTypeLabel, projectSectionHash };
