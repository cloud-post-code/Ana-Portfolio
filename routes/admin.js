const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const cms = require('../lib/cms-store');
const { getProjectType, projectTypeLabel } = require('../lib/portfolio-helpers');
const { getResumeTailorModelOptions, getResumeTailorDefaultSelection } = require('../lib/resume-tailor-models');
const { getMaxResumePageLines, getMaxCoverLetterLines } = require('../lib/resume-line-budget');
const { getProfileNotesCount } = require('../lib/resume-profile-notes');
const { getHeroVideoMeta } = require('../lib/hero-video');

router.get('/', async function (req, res, next) {
  try {
    const experiences = (await cms.getPortfolio('experiences')).sort((a, b) => a.order - b.order);
    const projects = (await cms.getPortfolio('projects')).sort((a, b) => a.order - b.order);
    const clientProjects = projects.filter((p) => getProjectType(p) === 'client');
    const personalProjects = projects.filter((p) => getProjectType(p) === 'personal');
    res.render('admin/dashboard', {
      experiences,
      projects,
      clientProjects,
      personalProjects,
      projectTypeLabel,
      databaseEnabled: cms.isDatabaseEnabled()
    });
  } catch (e) {
    next(e);
  }
});

router.get('/experiences/new', (req, res) => {
  res.render('admin/entity-form', { item: null, isNew: true, entity: 'experiences' });
});

router.get('/experiences/:id/edit', async function (req, res, next) {
  try {
    const experiences = await cms.getPortfolio('experiences');
    const item = experiences.find(e => e.id === req.params.id);
    if (!item) return res.status(404).send('Not found');
    res.render('admin/entity-form', { item, isNew: false, entity: 'experiences' });
  } catch (e) {
    next(e);
  }
});

router.get('/resume/profile-notes', async function (req, res, next) {
  try {
    const resumeTailorModels = getResumeTailorModelOptions();
    const resumeTailorDefault = getResumeTailorDefaultSelection();
    res.render('admin/profile-notes', {
      adminTitle: 'Profile notes',
      hasLlmKey: !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
      hasOpenAiForEnhance: !!process.env.OPENAI_API_KEY,
      resumeTailorModels,
      resumeTailorDefault,
      maxResumePageLines: getMaxResumePageLines(),
      maxCoverLetterLines: getMaxCoverLetterLines()
    });
  } catch (e) {
    next(e);
  }
});

router.get('/hero-video', async function (req, res, next) {
  try {
    const heroVideo = await getHeroVideoMeta();
    res.render('admin/hero-video', {
      adminTitle: 'Hero video',
      heroVideo,
      databaseEnabled: cms.isDatabaseEnabled()
    });
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
    let hasMd = fs.existsSync(path.join(publicDir, 'resume.md'));
    if (!hasMd && cms.isDatabaseEnabled()) {
      const rm = await cms.getKv('resume_markdown');
      hasMd = !!(rm && typeof rm.content === 'string' && rm.content.length > 0);
    }
    const resumeFileExists = hasPdf || hasDocx || hasMd;

    const resumeTailorModels = getResumeTailorModelOptions();
    const resumeTailorDefault = getResumeTailorDefaultSelection();
    const profileNotesCount = await getProfileNotesCount(cms);

    res.render('admin/resume', {
      adminTitle: 'Resume',
      resume,
      resumeFileExists,
      hasLlmKey: !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
      hasOpenAiForEnhance: !!process.env.OPENAI_API_KEY,
      resumeTailorModels,
      resumeTailorDefault,
      maxResumePageLines: getMaxResumePageLines(),
      maxCoverLetterLines: getMaxCoverLetterLines(),
      profileNotesCount
    });
  } catch (e) {
    next(e);
  }
});

router.get('/projects/new', (req, res) => {
  const initialProjectType = req.query.type === 'personal' ? 'personal' : 'client';
  res.render('admin/entity-form', { item: null, isNew: true, entity: 'projects', initialProjectType });
});

router.get('/projects/:id/edit', async function (req, res, next) {
  try {
    const projects = await cms.getPortfolio('projects');
    const item = projects.find(p => p.id === req.params.id);
    if (!item) return res.status(404).send('Not found');
    res.render('admin/entity-form', { item, isNew: false, entity: 'projects' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
