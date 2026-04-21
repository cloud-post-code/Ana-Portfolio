const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const cms = require('../lib/cms-store');
const { getResumeTailorModelOptions, getResumeTailorDefaultSelection } = require('../lib/resume-tailor-models');

router.get('/', async function (req, res, next) {
  try {
    const experiences = (await cms.getPortfolio('experiences')).sort((a, b) => a.order - b.order);
    const projects = (await cms.getPortfolio('projects')).sort((a, b) => a.order - b.order);
    res.render('admin/dashboard', { experiences, projects });
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
    let hasMd = fs.existsSync(path.join(publicDir, 'resume.md'));
    if (!hasMd && cms.isDatabaseEnabled()) {
      const rm = await cms.getKv('resume_markdown');
      hasMd = !!(rm && typeof rm.content === 'string' && rm.content.length > 0);
    }
    const resumeFileExists = hasPdf || hasDocx || hasMd;

    const resumeTailorModels = getResumeTailorModelOptions();
    const resumeTailorDefault = getResumeTailorDefaultSelection();

    res.render('admin/resume', {
      adminTitle: 'Resume',
      resume,
      resumeFileExists,
      hasLlmKey: !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY),
      resumeTailorModels,
      resumeTailorDefault
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
