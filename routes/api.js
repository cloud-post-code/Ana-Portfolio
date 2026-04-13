const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|webm|mov/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split('/')[1]);
    cb(null, ext || mime);
  }
});

const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'public');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, 'resume.pdf');
  }
});

const uploadResume = multer({
  storage: resumeStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const ok = ext === '.pdf' || file.mimetype === 'application/pdf';
    cb(null, ok);
  }
});

const cms = require('../lib/cms-store');
const JOBS_CRM_FILE = 'jobs-crm.json';

function dataPath(filename) {
  return path.join(__dirname, '..', 'data', filename);
}

async function loadData(filename) {
  if (filename === JOBS_CRM_FILE) return cms.getJobsCrm();
  if (filename === 'experiences.json') return cms.getPortfolio('experiences');
  if (filename === 'projects.json') return cms.getPortfolio('projects');
  if (filename === 'resume.json') {
    const v = await cms.getKv('resume');
    if (v != null) return v;
    return { path: null, originalFilename: null, updatedAt: null };
  }
  if (filename === 'job-search-profile.json') {
    return cms.getKv('job_search_profile');
  }
  return JSON.parse(fs.readFileSync(dataPath(filename), 'utf8'));
}

async function saveData(filename, data) {
  if (filename === JOBS_CRM_FILE) return cms.saveJobsCrm(data);
  if (filename === 'experiences.json') return cms.savePortfolio('experiences', data);
  if (filename === 'projects.json') return cms.savePortfolio('projects', data);
  if (filename === 'resume.json') return cms.setKv('resume', data);
  fs.mkdirSync(path.dirname(dataPath(filename)), { recursive: true });
  fs.writeFileSync(dataPath(filename), JSON.stringify(data, null, 2));
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ─── Upload ────────────────────────────────────────────────────────────────
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ path: `uploads/${req.file.filename}`, filename: req.file.filename });
});

router.post('/upload/multiple', upload.array('files', 20), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
  const results = req.files.map(f => ({ path: `uploads/${f.filename}`, filename: f.filename }));
  res.json(results);
});

// ─── Generic CRUD factory ──────────────────────────────────────────────────
function crudRoutes(entityName, filename) {
  router.get(`/${entityName}`, async function (req, res, next) {
    try {
      const data = (await loadData(filename)).sort((a, b) => (a.order || 0) - (b.order || 0));
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  router.get(`/${entityName}/:id`, async function (req, res, next) {
    try {
      const data = await loadData(filename);
      const item = data.find(d => d.id === req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });
      res.json(item);
    } catch (e) {
      next(e);
    }
  });

  router.post(`/${entityName}`, async function (req, res, next) {
    try {
      const data = await loadData(filename);
      const newItem = {
        id: `${entityName.slice(0, 3)}-${uuidv4().slice(0, 8)}`,
        slug: slugify(req.body.title || 'untitled'),
        title: req.body.title || '',
        sectionLabel: req.body.sectionLabel || (entityName === 'experiences' ? 'Work experience' : 'Personal project'),
        type: req.body.type || '',
        role: req.body.role || '',
        company: req.body.company || '',
        dateRange: req.body.dateRange || '',
        description: req.body.description || '',
        logo: req.body.logo || '',
        skills: req.body.skills || [],
        subtitle: req.body.subtitle || '',
        meta: req.body.meta || '',
        headerStyle: req.body.headerStyle || 'standard',
        logoWide: req.body.logoWide || false,
        tileClass: req.body.tileClass || '',
        hidden: req.body.hidden || false,
        deliverables: req.body.deliverables || [],
        order: req.body.order != null ? req.body.order : data.length + 1
      };

      let slug = newItem.slug;
      let counter = 2;
      while (data.some(d => d.slug === slug)) {
        slug = `${newItem.slug}-${counter++}`;
      }
      newItem.slug = slug;

      data.push(newItem);
      await saveData(filename, data);
      res.status(201).json(newItem);
    } catch (e) {
      next(e);
    }
  });

  router.put(`/${entityName}/:id`, async function (req, res, next) {
    try {
      const data = await loadData(filename);
      const idx = data.findIndex(d => d.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });

      const updated = { ...data[idx], ...req.body, id: data[idx].id };
      if (req.body.title && req.body.title !== data[idx].title) {
        updated.slug = slugify(req.body.title);
        let slug = updated.slug;
        let counter = 2;
        while (data.some((d, i) => i !== idx && d.slug === slug)) {
          slug = `${updated.slug}-${counter++}`;
        }
        updated.slug = slug;
      }
      data[idx] = updated;
      await saveData(filename, data);
      res.json(updated);
    } catch (e) {
      next(e);
    }
  });

  router.delete(`/${entityName}/:id`, async function (req, res, next) {
    try {
      const data = await loadData(filename);
      const idx = data.findIndex(d => d.id === req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      data.splice(idx, 1);
      await saveData(filename, data);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });

  router.post(`/${entityName}/:id/deliverables`, async function (req, res, next) {
    try {
      const data = await loadData(filename);
      const item = data.find(d => d.id === req.params.id);
      if (!item) return res.status(404).json({ error: 'Not found' });

      const deliverable = {
        id: `del-${uuidv4().slice(0, 8)}`,
        title: req.body.title || '',
        description: req.body.description || '',
        galleryClass: req.body.galleryClass || '',
        media: req.body.media || []
      };

      item.deliverables = item.deliverables || [];
      item.deliverables.push(deliverable);
      await saveData(filename, data);
      res.status(201).json(deliverable);
    } catch (e) {
      next(e);
    }
  });

  router.put(`/${entityName}/:id/deliverables/:did`, async function (req, res, next) {
    try {
      const data = await loadData(filename);
      const item = data.find(d => d.id === req.params.id);
      if (!item) return res.status(404).json({ error: 'Item not found' });

      const delIdx = (item.deliverables || []).findIndex(d => d.id === req.params.did);
      if (delIdx === -1) return res.status(404).json({ error: 'Deliverable not found' });

      item.deliverables[delIdx] = { ...item.deliverables[delIdx], ...req.body, id: req.params.did };
      await saveData(filename, data);
      res.json(item.deliverables[delIdx]);
    } catch (e) {
      next(e);
    }
  });

  router.delete(`/${entityName}/:id/deliverables/:did`, async function (req, res, next) {
    try {
      const data = await loadData(filename);
      const item = data.find(d => d.id === req.params.id);
      if (!item) return res.status(404).json({ error: 'Item not found' });

      item.deliverables = (item.deliverables || []).filter(d => d.id !== req.params.did);
      await saveData(filename, data);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  });
}

crudRoutes('experiences', 'experiences.json');
crudRoutes('projects', 'projects.json');

const { slugify: coverLetterFileSlug } = require('../lib/cover-letter');
const { generateCoverLetterSmart } = require('../lib/cover-letter-ai');
const { plainTextToDocxBuffer } = require('../lib/cover-letter-docx');
const { buildApplicationPackZip } = require('../lib/application-pack');

router.get('/jobs-crm/:id/cover-letter', async function (req, res, next) {
  try {
    const jobs = await loadData(JOBS_CRM_FILE);
    const job = jobs.find(j => j.id === req.params.id);
    if (!job) return res.status(404).send('Job not found');

    let experiences = [];
    try {
      const ex = await loadData('experiences.json');
      experiences = ex.sort((a, b) => (a.order || 0) - (b.order || 0));
    } catch (e) {
      /* optional */
    }

    let profile = null;
    try {
      profile = await loadData('job-search-profile.json');
    } catch (e) {
      /* optional */
    }

    const text = await generateCoverLetterSmart({ job, experiences, profile });
    const slug = coverLetterFileSlug(job.co);
    const coverBuf = await plainTextToDocxBuffer(text);

    const resumePdfPath = path.join(__dirname, '..', 'public', 'resume.pdf');
    let resumeBuf = null;
    let resumeMeta = null;
    try {
      resumeMeta = await loadData('resume.json');
    } catch (e) {
      /* optional */
    }
    if (fs.existsSync(resumePdfPath)) {
      try {
        resumeBuf = await fs.promises.readFile(resumePdfPath);
      } catch (readErr) {
        console.warn('[application-pack] Could not read resume.pdf:', readErr.message || readErr);
      }
    }

    const zipBuf = await buildApplicationPackZip({
      coverDocxBuffer: coverBuf,
      resumePdfBuffer: resumeBuf,
      resumeEntryName: resumeMeta && resumeMeta.originalFilename,
      slug
    });

    const zipName = `Application-${slug}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName.replace(/"/g, '')}"`);
    res.setHeader('X-Application-Pack-Includes-Resume', resumeBuf ? 'yes' : 'no');
    res.send(zipBuf);
  } catch (e) {
    if (e && (e.code === 'ENOENT' || String(e.message).includes('JSON'))) {
      return res.status(404).send('Jobs CRM data not found');
    }
    next(e);
  }
});

router.patch('/jobs-crm/:id', async function (req, res, next) {
  try {
    const data = await loadData(JOBS_CRM_FILE);
    const idx = data.findIndex(j => j.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Job not found' });
    let changed = false;
    if (typeof req.body.starred === 'boolean') {
      data[idx].starred = req.body.starred;
      changed = true;
    }
    if (req.body.st !== undefined) {
      const st = String(req.body.st).trim().slice(0, 120);
      if (!st) return res.status(400).json({ error: 'st cannot be empty' });
      data[idx].st = st;
      changed = true;
    }
    if (req.body.pri !== undefined) {
      const pri = String(req.body.pri).trim().slice(0, 40);
      if (!pri) return res.status(400).json({ error: 'pri cannot be empty' });
      data[idx].pri = pri;
      changed = true;
    }
    if (req.body.deadline !== undefined) {
      const dl = String(req.body.deadline).trim().slice(0, 120);
      if (!dl) delete data[idx].deadline;
      else data[idx].deadline = dl;
      changed = true;
    }
    if (req.body.notes !== undefined) {
      const n = String(req.body.notes).trim().slice(0, 8000);
      if (!n) delete data[idx].notes;
      else data[idx].notes = n;
      changed = true;
    }
    if (req.body.yoe !== undefined) {
      const y = String(req.body.yoe).trim().slice(0, 60);
      if (!y) delete data[idx].yoe;
      else data[idx].yoe = y;
      changed = true;
    }
    if (!changed) {
      return res.status(400).json({ error: 'Provide starred, st, pri, deadline, notes, and/or yoe' });
    }
    await saveData(JOBS_CRM_FILE, data);
    res.json(data[idx]);
  } catch (e) {
    next(e);
  }
});

router.delete('/jobs-crm', async function (req, res, next) {
  try {
    const data = await loadData(JOBS_CRM_FILE);
    const removed = Array.isArray(data) ? data.length : 0;
    await saveData(JOBS_CRM_FILE, []);
    res.json({ success: true, removed });
  } catch (e) {
    next(e);
  }
});

router.delete('/jobs-crm/:id', async function (req, res, next) {
  try {
    const data = await loadData(JOBS_CRM_FILE);
    const idx = data.findIndex(j => j.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Job not found' });
    data.splice(idx, 1);
    await saveData(JOBS_CRM_FILE, data);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

router.post('/resume', uploadResume.single('resume'), async function (req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Upload a PDF file.' });
    }
    const meta = {
      path: '/resume.pdf',
      originalFilename: req.file.originalname || 'resume.pdf',
      updatedAt: new Date().toISOString()
    };
    await saveData('resume.json', meta);
    res.json(meta);
  } catch (e) {
    next(e);
  }
});

router.delete('/resume', async function (req, res, next) {
  try {
    const fp = path.join(__dirname, '..', 'public', 'resume.pdf');
    try {
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch (e) {
      /* ignore */
    }
    await saveData('resume.json', { path: null, originalFilename: null, updatedAt: null });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

const { enhanceItem, enhanceAll, assertConfigured, DATA_FILES: ENHANCE_DATA_FILES } = require('../lib/enhance-service');

router.post('/enhance', (req, res) => {
  const secret = process.env.ADMIN_ENHANCE_SECRET;
  if (secret) {
    const h = req.headers['x-enhance-secret'] || (req.headers.authorization && String(req.headers.authorization).replace(/^Bearer\s+/i, ''));
    if (h !== secret) {
      return res.status(401).json({ error: 'Set header x-enhance-secret to match ADMIN_ENHANCE_SECRET.' });
    }
  }

  const body = req.body || {};
  const collection = body.collection;
  if (!collection || !ENHANCE_DATA_FILES[collection]) {
    return res.status(400).json({ error: 'collection must be experiences, projects, or jobs-crm' });
  }

  try {
    assertConfigured();
  } catch (e) {
    return res.status(503).json({ error: e.message || String(e) });
  }

  if (body.all === true) {
    return enhanceAll(collection)
      .then(function (out) {
        res.json(out);
      })
      .catch(function (e) {
        res.status(500).json({ error: e.message || String(e) });
      });
  }

  const id = body.id;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Provide id (string) or all: true' });
  }

  return enhanceItem(collection, id)
    .then(function (out) {
      res.json(out);
    })
    .catch(function (e) {
      if (String(e.message).includes('Not found')) {
        return res.status(404).json({ error: e.message });
      }
      res.status(500).json({ error: e.message || String(e) });
    });
});

const { runJobHunterSkill, normalizeTargetJobCount } = require('../lib/job-hunter-claude');
const { parseOpenRolesTable } = require('../lib/job-hunter-open-roles');
const { verifyOpenRoleRows } = require('../lib/job-leads-verify');
const { applyOpenRoleDefaults } = require('../lib/job-leads-defaults');
const { resolveUrlsOnRows } = require('../lib/resolve-employer-url');
const { enrichOpenRolesRows } = require('../lib/job-hunter-enrich');
const { mergeJobHunterOpenRolesIntoCrm } = require('../lib/job-hunter-persist');

router.post('/job-hunter/find-jobs', async function (req, res, next) {
  const body = req.body || {};
  const searchQuery = body.searchQuery != null ? String(body.searchQuery) : '';
  const criteria = body.criteria != null ? String(body.criteria) : '';
  if (!searchQuery.trim() && !criteria.trim()) {
    return res.status(400).json({ error: 'Enter a search query and/or additional criteria.' });
  }

  const targetJobCount = normalizeTargetJobCount(body.targetJobCount);

  let existingJobs = [];
  try {
    const crm = await loadData(JOBS_CRM_FILE);
    if (Array.isArray(crm)) {
      existingJobs = crm.map(function (j) {
        return {
          id: j.id,
          co: j.co,
          role: j.role,
          loc: j.loc || '',
          url: j.url || ''
        };
      });
    }
  } catch (e) {
    /* optional */
  }

  try {
    const out = await runJobHunterSkill({ searchQuery, criteria, existingJobs, targetJobCount });
    const parsed = parseOpenRolesTable(out.text);
    let rows = parsed.rows;
    const listingFetchCache = new Map();
    rows = await resolveUrlsOnRows(rows, 4, listingFetchCache);
    rows = await enrichOpenRolesRows(rows, {
      maxRows: targetJobCount,
      listingFetchCache: listingFetchCache,
      fetchConcurrency: 4
    });
    const openRoles = applyOpenRoleDefaults(
      verifyOpenRoleRows(rows, {
        existingJobs,
        webSnippets: out.webSnippets || ''
      })
    );

    let crmSave = { added: 0, skipped: 0, newIds: [] };
    try {
      crmSave = await mergeJobHunterOpenRolesIntoCrm(openRoles);
    } catch (saveErr) {
      console.error('[job-hunter] CRM save failed:', saveErr);
      crmSave = {
        added: 0,
        skipped: 0,
        newIds: [],
        error: saveErr.message || String(saveErr)
      };
    }

    res.json({
      ok: true,
      text: out.text,
      model: out.model,
      targetJobCount: out.targetJobCount != null ? out.targetJobCount : targetJobCount,
      openRoles,
      crmSave: crmSave
    });
  } catch (e) {
    const msg = e.message || String(e);
    if (msg.includes('ANTHROPIC_API_KEY') || msg.includes('Job Hunter skill not found')) {
      return res.status(503).json({ error: msg });
    }
    next(e);
  }
});

module.exports = router;
