const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const cms = require('../lib/cms-store');
const { mergeProfile } = require('../lib/job-search-profile');
const { CRM_JOB_STATUSES } = require('./crm-constants');
const {
  regionFromLoc,
  tracksForJob,
  TRACK_DEFS
} = require('./job-crm-helpers');

router.get('/', async function (req, res, next) {
  try {
    const experiences = (await cms.getPortfolio('experiences')).sort((a, b) => a.order - b.order);
    const projects = (await cms.getPortfolio('projects')).sort((a, b) => a.order - b.order);
    let jobsCrm = [];
    let starredJobCount = 0;
    try {
      const raw = await cms.getJobsCrm();
      const starred = [];
      const rest = [];
      raw.forEach(function (j) {
        if (j.starred) starred.push(j);
        else rest.push(j);
      });
      starredJobCount = starred.length;
      jobsCrm = starred.concat(rest);
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
      usePostgres: cms.isDatabaseEnabled()
    });
  } catch (e) {
    next(e);
  }
});

router.get('/experiences/new', (req, res) => {
  res.render('admin/experience-form', { item: null, isNew: true });
});

router.get('/experiences/:id/edit', async function (req, res, next) {
  try {
    const experiences = await cms.getPortfolio('experiences');
    const item = experiences.find(e => e.id === req.params.id);
    if (!item) return res.status(404).send('Not found');
    res.render('admin/experience-form', { item, isNew: false });
  } catch (e) {
    next(e);
  }
});

router.get('/resume', async function (req, res, next) {
  try {
    let resume = { path: null, originalFilename: null, updatedAt: null };
    const v = await cms.getKv('resume');
    if (v != null) resume = v;
    const publicDir = path.join(__dirname, '..', 'public');
    const hasPdf = fs.existsSync(path.join(publicDir, 'resume.pdf'));
    const hasDocx = fs.existsSync(path.join(publicDir, 'resume.docx'));
    const resumeFileExists = hasPdf || hasDocx;
    const baselineResumePath = path.join(publicDir, 'baseline-resume.docx');
    const legacyGenPath = path.join(publicDir, 'generated-resume.docx');
    const baselineResumeFileExists =
      fs.existsSync(baselineResumePath) || fs.existsSync(legacyGenPath);
    const baselineResumePublicHref = fs.existsSync(baselineResumePath)
      ? '/baseline-resume.docx'
      : '/generated-resume.docx';

    let profileRaw = await cms.getKv('job_search_profile');
    if (profileRaw == null) {
      try {
        const jf = path.join(__dirname, '..', 'data', 'job-search-profile.json');
        if (fs.existsSync(jf)) {
          profileRaw = JSON.parse(fs.readFileSync(jf, 'utf8'));
        }
      } catch (e) {
        profileRaw = null;
      }
    }
    const jobProfile = mergeProfile(profileRaw);

    const experiences = (await cms.getPortfolio('experiences')).sort((a, b) => (a.order || 0) - (b.order || 0));
    const projects = (await cms.getPortfolio('projects')).sort((a, b) => (a.order || 0) - (b.order || 0));

    res.render('admin/resume', {
      adminTitle: 'Resume',
      resume,
      resumeFileExists,
      baselineResumeFileExists,
      baselineResumePublicHref,
      jobProfile,
      experiences,
      projects
    });
  } catch (e) {
    next(e);
  }
});

router.get('/projects/new', (req, res) => {
  res.render('admin/project-form', { item: null, isNew: true });
});

router.get('/projects/:id/edit', async function (req, res, next) {
  try {
    const projects = await cms.getPortfolio('projects');
    const item = projects.find(p => p.id === req.params.id);
    if (!item) return res.status(404).send('Not found');
    res.render('admin/project-form', { item, isNew: false });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
