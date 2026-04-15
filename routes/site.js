const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const cms = require('../lib/cms-store');

router.get('/', async function (req, res, next) {
  try {
    const experiences = (await cms.getPortfolio('experiences')).sort((a, b) => a.order - b.order);
    const projects = (await cms.getPortfolio('projects')).sort((a, b) => a.order - b.order);
    const publicDir = path.join(__dirname, '..', 'public');
    let resume = { path: null, originalFilename: null, updatedAt: null };
    const v = await cms.getKv('resume');
    if (v != null) resume = { ...resume, ...v };
    const pdfPath = path.join(publicDir, 'resume.pdf');
    const docxPath = path.join(publicDir, 'resume.docx');
    const mdPath = path.join(publicDir, 'resume.md');
    const hasPdf = fs.existsSync(pdfPath);
    const hasDocx = fs.existsSync(docxPath);
    let hasMd = fs.existsSync(mdPath);
    if (!hasMd && cms.isDatabaseEnabled()) {
      const rm = await cms.getKv('resume_markdown');
      hasMd = !!(rm && typeof rm.content === 'string' && rm.content.length > 0);
    }
    const rel = resume.path ? String(resume.path).replace(/^\//, '') : '';
    const metaOk = rel && fs.existsSync(path.join(publicDir, rel));
    let resumeFileExists = metaOk || hasPdf || hasDocx || hasMd;
    if (resumeFileExists && !metaOk) {
      if (hasMd) resume.path = '/resume.md';
      else resume.path = hasPdf ? '/resume.pdf' : '/resume.docx';
    }
    res.render('index', { experiences, projects, resume, resumeFileExists });
  } catch (e) {
    next(e);
  }
});

router.get('/experience/:slug', async function (req, res, next) {
  try {
    const experiences = await cms.getPortfolio('experiences');
    const item = experiences.find(e => e.slug === req.params.slug);
    if (!item) return res.status(404).send('Experience not found');
    res.render('detail', { item, itemType: 'experience' });
  } catch (e) {
    next(e);
  }
});

router.get('/project/:slug', async function (req, res, next) {
  try {
    const projects = await cms.getPortfolio('projects');
    const item = projects.find(p => p.slug === req.params.slug);
    if (!item) return res.status(404).send('Project not found');
    res.render('detail', { item, itemType: 'project' });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
