const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { CRM_JOB_STATUSES } = require('./crm-constants');
const {
  regionFromLoc,
  tracksForJob,
  TRACK_DEFS
} = require('./job-crm-helpers');

function loadJSON(filename) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', filename), 'utf8'));
}

router.get('/', (req, res) => {
  const experiences = loadJSON('experiences.json').sort((a, b) => a.order - b.order);
  const projects = loadJSON('projects.json').sort((a, b) => a.order - b.order);
  let jobsCrm = [];
  let starredJobCount = 0;
  try {
    const raw = loadJSON('jobs-crm.json');
    const starred = [];
    const rest = [];
    raw.forEach(function (j) {
      if (j.starred) starred.push(j);
      else rest.push(j);
    });
    starredJobCount = starred.length;
    jobsCrm = starred.concat(rest);
  } catch (e) {
    /* optional data file */
  }

  let jobSearchProfile = null;
  try {
    jobSearchProfile = loadJSON('job-search-profile.json');
  } catch (e) {
    /* optional */
  }

  const crmJobRows = jobsCrm.map(function (job) {
    return {
      job,
      region: regionFromLoc(job.loc),
      tracks: tracksForJob(job)
    };
  });

  res.render('admin/dashboard', {
    experiences,
    projects,
    jobsCrm,
    crmJobRows,
    starredJobCount,
    crmStatusOptions: CRM_JOB_STATUSES,
    crmTrackOptions: TRACK_DEFS,
    jobSearchProfile
  });
});

router.get('/experiences/new', (req, res) => {
  res.render('admin/experience-form', { item: null, isNew: true });
});

router.get('/experiences/:id/edit', (req, res) => {
  const experiences = loadJSON('experiences.json');
  const item = experiences.find(e => e.id === req.params.id);
  if (!item) return res.status(404).send('Not found');
  res.render('admin/experience-form', { item, isNew: false });
});

router.get('/resume', (req, res) => {
  let resume = { path: null, originalFilename: null, updatedAt: null };
  try {
    resume = loadJSON('resume.json');
  } catch (e) {
    /* optional */
  }
  const fp = path.join(__dirname, '..', 'public', 'resume.pdf');
  const resumeFileExists = fs.existsSync(fp);
  res.render('admin/resume', { adminTitle: 'Resume', resume, resumeFileExists });
});

router.get('/projects/new', (req, res) => {
  res.render('admin/project-form', { item: null, isNew: true });
});

router.get('/projects/:id/edit', (req, res) => {
  const projects = loadJSON('projects.json');
  const item = projects.find(p => p.id === req.params.id);
  if (!item) return res.status(404).send('Not found');
  res.render('admin/project-form', { item, isNew: false });
});

module.exports = router;
