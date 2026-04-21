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

const uploadResume = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const okPdf = ext === '.pdf' || mime === 'application/pdf';
    const okDocx =
      ext === '.docx' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    cb(null, okPdf || okDocx);
  }
});

const cms = require('../lib/cms-store');
const { extractResumeDocumentText } = require('../lib/resume-ingest-text');
const { buildResumeMarkdown } = require('../lib/resume-to-markdown');

async function loadData(filename) {
  if (filename === 'experiences.json') return cms.getPortfolio('experiences');
  if (filename === 'projects.json') return cms.getPortfolio('projects');
  if (filename === 'resume.json') {
    const v = await cms.getKv('resume');
    const defaults = { path: null, originalFilename: null, updatedAt: null };
    if (v == null) return defaults;
    return { ...defaults, ...v };
  }
  throw new Error('loadData: unknown file ' + filename);
}

async function saveData(filename, data) {
  if (filename === 'experiences.json') return cms.savePortfolio('experiences', data);
  if (filename === 'projects.json') return cms.savePortfolio('projects', data);
  if (filename === 'resume.json') return cms.setKv('resume', data);
  throw new Error('saveData: unknown file ' + filename);
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

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const RESUME_MD_FS = path.join(PUBLIC_DIR, 'resume.md');
const RESUME_MD_KV = 'resume_markdown';
const { editResumeMarkdownWithPrompt } = require('../lib/resume-md-ai-edit');

async function readResumeMarkdownBody() {
  if (cms.isDatabaseEnabled()) {
    const row = await cms.getKv(RESUME_MD_KV);
    if (row && typeof row.content === 'string') return row.content;
  }
  if (fs.existsSync(RESUME_MD_FS)) {
    return await fs.promises.readFile(RESUME_MD_FS, 'utf8');
  }
  return '';
}

async function persistResumeMarkdown(md) {
  if (cms.isDatabaseEnabled()) {
    await cms.setKv(RESUME_MD_KV, { content: md });
  }
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  await fs.promises.writeFile(RESUME_MD_FS, md, 'utf8');
}

router.get('/resume/md', async function (req, res, next) {
  try {
    const markdown = await readResumeMarkdownBody();
    res.json({ markdown });
  } catch (e) {
    next(e);
  }
});

router.put('/resume/md', async function (req, res, next) {
  try {
    const body = req.body || {};
    const md = body.markdown != null ? String(body.markdown) : '';
    await persistResumeMarkdown(md);

    let meta = await loadData('resume.json');
    if (!meta || typeof meta !== 'object') {
      meta = { path: null, originalFilename: null, updatedAt: null };
    }
    meta.path = '/resume.md';
    if (!meta.originalFilename) meta.originalFilename = 'resume.md';
    meta.updatedAt = new Date().toISOString();
    await saveData('resume.json', meta);

    res.json({
      success: true,
      path: meta.path,
      originalFilename: meta.originalFilename,
      updatedAt: meta.updatedAt,
      markdownBytes: Buffer.byteLength(md, 'utf8')
    });
  } catch (e) {
    next(e);
  }
});

router.post('/resume/md/ai-edit', async function (req, res, next) {
  try {
    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        error: 'OPENAI_API_KEY or ANTHROPIC_API_KEY is required to edit with AI.'
      });
    }
    const body = req.body || {};
    const markdown = body.markdown != null ? String(body.markdown) : '';
    const prompt = body.prompt != null ? String(body.prompt) : '';
    if (!String(prompt).trim()) {
      return res.status(400).json({ error: 'prompt is required' });
    }
    if (!String(markdown).trim()) {
      return res.status(400).json({ error: 'markdown is empty — add content in the editor or upload a resume first' });
    }

    const revised = await editResumeMarkdownWithPrompt(markdown, prompt);
    await persistResumeMarkdown(revised);

    let meta = await loadData('resume.json');
    if (!meta || typeof meta !== 'object') {
      meta = { path: null, originalFilename: null, updatedAt: null };
    }
    meta.path = '/resume.md';
    if (!meta.originalFilename) meta.originalFilename = 'resume.md';
    meta.updatedAt = new Date().toISOString();
    await saveData('resume.json', meta);

    res.json({
      markdown: revised,
      path: meta.path,
      originalFilename: meta.originalFilename,
      updatedAt: meta.updatedAt,
      markdownBytes: Buffer.byteLength(revised, 'utf8')
    });
  } catch (e) {
    next(e);
  }
});

router.post('/resume', uploadResume.single('resume'), async function (req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Upload a PDF or Word (.docx) file.' });
    }
    const ext = path.extname(req.file.originalname || '').toLowerCase();
    const buf = req.file.buffer;
    const { text, error: readErr } = await extractResumeDocumentText(buf, ext);
    if (readErr || !String(text || '').trim()) {
      return res.status(400).json({
        error: readErr || 'Could not read text from this file (empty or image-only PDF).'
      });
    }

    const md = buildResumeMarkdown(text, req.file.originalname);
    await persistResumeMarkdown(md);

    [path.join(PUBLIC_DIR, 'resume.pdf'), path.join(PUBLIC_DIR, 'resume.docx')].forEach(function (p) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (e) {
        /* ignore */
      }
    });

    const meta = {
      path: '/resume.md',
      originalFilename: req.file.originalname || (ext === '.docx' ? 'resume.docx' : 'resume.pdf'),
      updatedAt: new Date().toISOString()
    };
    await saveData('resume.json', meta);

    res.json({
      ...meta,
      markdownBytes: Buffer.byteLength(md, 'utf8')
    });
  } catch (e) {
    next(e);
  }
});

router.delete('/resume', async function (req, res, next) {
  try {
    const pub = path.join(__dirname, '..', 'public');
    [path.join(pub, 'resume.pdf'), path.join(pub, 'resume.docx'), path.join(pub, 'resume.md')].forEach(function (p) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (e) {
        /* ignore */
      }
    });
    [path.join(pub, 'baseline-resume.docx'), path.join(pub, 'generated-resume.docx')].forEach(function (p) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch (e) {
        /* ignore */
      }
    });
    await saveData('resume.json', {
      path: null,
      originalFilename: null,
      updatedAt: null
    });
    if (cms.isDatabaseEnabled()) {
      await cms.deleteKv(RESUME_MD_KV);
    }
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
    return res.status(400).json({ error: 'collection must be experiences or projects' });
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

module.exports = router;
