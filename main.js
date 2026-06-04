(() => {
  'use strict';

  // ---- Scroll Reveal (all animation types) ----
  const revealSelectors = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-blur, .reveal-clip';
  const revealElements = document.querySelectorAll(revealSelectors);

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal--visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
  );

  revealElements.forEach((el) => revealObserver.observe(el));

  // ---- Hero Title Split Text Animation ----
  const heroTitleInners = document.querySelectorAll('.hero__title-inner');
  requestAnimationFrame(() => {
    setTimeout(() => {
      heroTitleInners.forEach((el) => el.classList.add('is-visible'));
    }, 300);
  });

  // ---- Scroll Progress Bar ----
  const scrollProgress = document.getElementById('scrollProgress');

  const updateScrollProgress = () => {
    if (!scrollProgress) return;
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? scrollTop / docHeight : 0;
    scrollProgress.style.transform = `scaleX(${progress})`;
  };

  // ---- Navbar Scroll Effect ----
  const nav = document.getElementById('nav');

  const handleNavScroll = () => {
    if (!nav) return;
    const scrollY = window.scrollY;
    const scrolled = scrollY > 48;
    nav.classList.toggle('nav--scrolled', scrolled);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nav.style.setProperty('--nav-bg-opacity', scrolled ? '0.96' : '0.88');
      nav.style.setProperty('--nav-border-opacity', '0.9');
      return;
    }

    const fadeEnd = 320;
    const t = Math.min(1, Math.max(0, scrollY / fadeEnd));
    nav.style.setProperty('--nav-bg-opacity', (0.74 + t * 0.22).toFixed(3));
    nav.style.setProperty('--nav-border-opacity', (0.5 + t * 0.42).toFixed(3));
  };

  // ---- Hero Parallax Fade on Scroll ----
  const heroContent = document.querySelector('.hero__content');
  const heroSection = document.querySelector('.hero');

  const handleHeroParallax = () => {
    if (document.body.classList.contains('portfolio-hero-marquee-focus')) return;
    const scrollY = window.scrollY;
    const heroH = heroSection ? heroSection.offsetHeight : window.innerHeight;

    if (scrollY < heroH && heroContent) {
      const ratio = scrollY / heroH;
      heroContent.style.opacity = 1 - ratio * 1.5;
      heroContent.style.transform = `translateY(${scrollY * 0.35}px)`;
    }
  };

  // ---- Combined Scroll Handler (batched via rAF) ----
  let ticking = false;

  const onScroll = () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        handleNavScroll();
        updateScrollProgress();
        handleHeroParallax();
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  handleNavScroll();
  updateScrollProgress();

  // ---- Mobile Menu Toggle + backdrop ----
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  let navBackdrop = null;

  const closeMobileMenu = () => {
    if (!navToggle || !navLinks) return;
    navToggle.classList.remove('nav__toggle--active');
    navLinks.classList.remove('nav__links--open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
    document.body.style.overflow = '';
    if (navBackdrop) navBackdrop.classList.remove('is-active');
  };

  if (navToggle && navLinks) {
    navBackdrop = document.createElement('div');
    navBackdrop.className = 'nav__backdrop';
    navBackdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(navBackdrop);

    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('nav__toggle--active');
      navLinks.classList.toggle('nav__links--open');
      const open = navLinks.classList.contains('nav__links--open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
      navBackdrop.classList.toggle('is-active', open);
    });

    navBackdrop.addEventListener('click', closeMobileMenu);

    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeMobileMenu);
    });

    window.addEventListener(
      'resize',
      () => {
        if (window.innerWidth > 768) closeMobileMenu();
      },
      { passive: true }
    );

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMobileMenu();
    });
  }

  // ---- Smooth Scroll for Anchor Links (same-page # only) ----
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const navH = nav ? nav.offsetHeight : 72;
      const top = target.getBoundingClientRect().top + window.scrollY - navH - 12;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // ---- Initial scroll when landing with hash (e.g. index.html#contact) ----
  const alignToHash = () => {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    const target = document.querySelector(hash);
    if (!target) return;
    requestAnimationFrame(() => {
      const navH = nav ? nav.offsetHeight : 72;
      const top = target.getBoundingClientRect().top + window.scrollY - navH - 12;
      window.scrollTo({ top, behavior: 'auto' });
    });
  };

  window.addEventListener('load', alignToHash);

  // ---- Staggered Reveal for Grid Children ----
  document.querySelectorAll('.brands__groups').forEach((container) => {
    const isWorkExperiences = container.closest('#brands');
    const step = isWorkExperiences ? 0.22 : 0.12;
    container.querySelectorAll(revealSelectors).forEach((child, i) => {
      child.style.transitionDelay = `${i * step}s`;
    });
  });

  // ---- Contact Glow Effect ----
  const contactContent = document.querySelector('.contact__content');

  if (contactContent) {
    const contactObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            contactContent.classList.add('glow-active');
            contactObserver.unobserve(contactContent);
          }
        });
      },
      { threshold: 0.3 }
    );
    contactObserver.observe(contactContent);
  }

  // ---- Parallax Float on About Accent Shape ----
  const accentShape = document.querySelector('.about__accent-shape');
  const aboutSection = document.querySelector('.about');

  if (accentShape && aboutSection) {
    const shapeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const onShapeScroll = () => {
              const rect = aboutSection.getBoundingClientRect();
              const progress = -rect.top / aboutSection.offsetHeight;
              accentShape.style.transform = `translate(${progress * 15}px, ${progress * -20}px) rotate(${progress * 8}deg)`;
            };
            window.addEventListener('scroll', onShapeScroll, { passive: true });
          }
        });
      },
      { threshold: 0 }
    );
    shapeObserver.observe(aboutSection);
  }

  // ---- Active Nav Link Tracking ----
  const sections = document.querySelectorAll('section[id]');

  const activeLinkObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && navLinks) {
          const id = entry.target.getAttribute('id');
          navLinks.querySelectorAll('a').forEach((link) => {
            link.style.color = '';
            const href = link.getAttribute('href') || '';
            if (href === `#${id}` || href.endsWith(`#${id}`)) {
              link.style.color = 'var(--color-accent)';
            }
          });
        }
      });
    },
    { threshold: 0.3, rootMargin: '0px 0px -12% 0px' }
  );

  sections.forEach((section) => activeLinkObserver.observe(section));

  // ---- Far Out: still slides (first frame only) + hover-to-preview videos ----
  const slideStills = document.querySelectorAll('.detail__slide-still');

  slideStills.forEach((video) => {
    const freezeFrame = () => {
      try {
        video.pause();
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
    };

    video.addEventListener('loadeddata', freezeFrame);
    video.addEventListener('seeked', freezeFrame);
  });

  const videoHoverWraps = document.querySelectorAll('.detail__video-hover');
  const prefersHover = window.matchMedia('(hover: hover)').matches;

  videoHoverWraps.forEach((wrap) => {
    const video = wrap.querySelector('video');
    if (!video) return;

    const primeFirstFrame = () => {
      try {
        video.pause();
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
    };

    video.addEventListener('loadeddata', primeFirstFrame);

    const tryPlay = () => {
      video.play().catch(() => {});
    };

    const reset = () => {
      wrap.classList.remove('detail__video-hover--playing');
      primeFirstFrame();
    };

    if (prefersHover) {
      wrap.addEventListener('mouseenter', tryPlay);
      wrap.addEventListener('mouseleave', reset);
      wrap.addEventListener('focusin', tryPlay);
      wrap.addEventListener('focusout', reset);
    }

    wrap.setAttribute('tabindex', '0');
  });

  // ---- Click-to-play/pause videos ----
  document.querySelectorAll('.detail__video-click').forEach((wrap) => {
    const video = wrap.querySelector('video');
    const btn = wrap.querySelector('.detail__video-click__btn');
    if (!video) return;

    const setState = (playing) => {
      wrap.dataset.state = playing ? 'playing' : 'paused';
      if (btn) btn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
    };

    const toggle = (e) => {
      if (e) e.stopPropagation();
      if (video.paused) {
        video.play().then(() => setState(true)).catch(() => {});
      } else {
        video.pause();
        setState(false);
      }
    };

    wrap.addEventListener('click', toggle);
    video.addEventListener('play', () => setState(true));
    video.addEventListener('pause', () => setState(false));
    video.addEventListener('ended', () => setState(false));
    setState(false);
  });

  // ---- Audio player bars (play/pause, seek, elapsed / total time) ----
  function formatAudioTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  document.querySelectorAll('.detail__audio').forEach((wrap) => {
    const audio = wrap.querySelector('.detail__audio__media');
    const btn = wrap.querySelector('.detail__audio__play');
    const seek = wrap.querySelector('.detail__audio__seek');
    const currentEl = wrap.querySelector('.detail__audio__current');
    const durationEl = wrap.querySelector('.detail__audio__duration');
    if (!audio) return;

    let seeking = false;

    const setState = (playing) => {
      wrap.dataset.state = playing ? 'playing' : 'paused';
      if (btn) btn.setAttribute('aria-label', playing ? 'Pause audio' : 'Play audio');
    };

    const updateDuration = () => {
      if (durationEl) durationEl.textContent = formatAudioTime(audio.duration);
    };

    const updateProgress = () => {
      if (seeking || !seek) return;
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      seek.value = String(pct);
      if (currentEl) currentEl.textContent = formatAudioTime(audio.currentTime);
    };

    const toggle = (e) => {
      if (e) e.stopPropagation();
      if (audio.paused) {
        document.querySelectorAll('.detail__audio__media').forEach((other) => {
          if (other !== audio && !other.paused) {
            try {
              other.pause();
            } catch {
              /* ignore */
            }
          }
        });
        audio.play().then(() => setState(true)).catch(() => {});
      } else {
        audio.pause();
        setState(false);
      }
    };

    if (btn) btn.addEventListener('click', toggle);

    audio.addEventListener('loadedmetadata', () => {
      updateDuration();
      updateProgress();
    });
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('play', () => setState(true));
    audio.addEventListener('pause', () => setState(false));
    audio.addEventListener('ended', () => {
      setState(false);
      if (seek) seek.value = '0';
      if (currentEl) currentEl.textContent = formatAudioTime(0);
    });

    if (seek) {
      seek.addEventListener('input', () => {
        seeking = true;
        const pct = Number(seek.value) / 100;
        const t = audio.duration ? pct * audio.duration : 0;
        if (currentEl) currentEl.textContent = formatAudioTime(t);
      });
      seek.addEventListener('change', () => {
        const pct = Number(seek.value) / 100;
        if (audio.duration) audio.currentTime = pct * audio.duration;
        seeking = false;
        updateProgress();
      });
    }

    setState(false);
    if (audio.readyState >= 1) updateDuration();

    if (wrap.dataset.autoplay === 'true') {
      const tryAutoplay = () => {
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducedMotion) return;
        audio.play().then(() => setState(true)).catch(() => {});
      };
      if (audio.readyState >= 1) {
        tryAutoplay();
      } else {
        audio.addEventListener('loadedmetadata', tryAutoplay, { once: true });
      }
    }
  });

  // ---- Detail page: fullscreen lightbox for gallery images & videos ----
  const detailMain = document.querySelector('main.detail');
  if (detailMain) {
    let lightboxItems = [];
    let lightboxIndex = -1;

    function closeDetailLightbox() {
      const root = document.getElementById('detailLightbox');
      if (!root || root.hidden) return;
      const frame = root.querySelector('.detail-lightbox__frame');
      if (frame) {
        frame.querySelectorAll('video').forEach((v) => {
          try {
            v.pause();
          } catch {
            /* ignore */
          }
        });
        frame.innerHTML = '';
      }
      root.hidden = true;
      document.body.classList.remove('detail-lightbox-open');
      lightboxItems = [];
      lightboxIndex = -1;
    }

    function ensureDetailLightbox() {
      let root = document.getElementById('detailLightbox');
      if (root) return root;
      root = document.createElement('div');
      root.id = 'detailLightbox';
      root.className = 'detail-lightbox';
      root.hidden = true;
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', 'Fullscreen media');
      root.innerHTML =
        '<div class="detail-lightbox__backdrop" aria-hidden="true"></div>' +
        '<button type="button" class="detail-lightbox__close" aria-label="Close fullscreen">&times;</button>' +
        '<button type="button" class="detail-lightbox__nav detail-lightbox__nav--prev" aria-label="Previous">&#8249;</button>' +
        '<button type="button" class="detail-lightbox__nav detail-lightbox__nav--next" aria-label="Next">&#8250;</button>' +
        '<div class="detail-lightbox__stage"><div class="detail-lightbox__frame"></div></div>';
      document.body.appendChild(root);
      root.querySelector('.detail-lightbox__backdrop').addEventListener('click', closeDetailLightbox);
      root.querySelector('.detail-lightbox__close').addEventListener('click', closeDetailLightbox);
      root.querySelector('.detail-lightbox__nav--prev').addEventListener('click', (e) => {
        e.stopPropagation();
        stepLightbox(-1);
      });
      root.querySelector('.detail-lightbox__nav--next').addEventListener('click', (e) => {
        e.stopPropagation();
        stepLightbox(1);
      });
      return root;
    }

    function buildNodeFromItem(item) {
      if (!item) return null;
      if (item.kind === 'image') {
        const i = document.createElement('img');
        i.alt = item.alt || '';
        i.src = item.src;
        return i;
      }
      const v = document.createElement('video');
      v.setAttribute('controls', '');
      v.setAttribute('playsinline', '');
      if (item.kind === 'video-loop') v.setAttribute('loop', '');
      v.src = item.src;
      return v;
    }

    function showLightboxIndex(i) {
      if (i < 0 || i >= lightboxItems.length) return;
      lightboxIndex = i;
      const root = ensureDetailLightbox();
      const frame = root.querySelector('.detail-lightbox__frame');
      frame.querySelectorAll('video').forEach((v) => { try { v.pause(); } catch { /* ignore */ } });
      frame.innerHTML = '';
      const node = buildNodeFromItem(lightboxItems[i]);
      if (!node) return;
      frame.appendChild(node);
      if (node.tagName === 'VIDEO') node.play().catch(() => {});
      const hasMany = lightboxItems.length > 1;
      root.querySelector('.detail-lightbox__nav--prev').hidden = !hasMany;
      root.querySelector('.detail-lightbox__nav--next').hidden = !hasMany;
    }

    function stepLightbox(delta) {
      if (!lightboxItems.length) return;
      const n = lightboxItems.length;
      showLightboxIndex((lightboxIndex + delta + n) % n);
    }

    document.addEventListener('keydown', (ev) => {
      const r = document.getElementById('detailLightbox');
      if (!r || r.hidden) return;
      if (ev.key === 'Escape') closeDetailLightbox();
      else if (ev.key === 'ArrowLeft') stepLightbox(-1);
      else if (ev.key === 'ArrowRight') stepLightbox(1);
    });

    function resolveVideoUrl(videoEl) {
      try {
        if (videoEl.currentSrc) return videoEl.currentSrc;
      } catch {
        /* ignore */
      }
      const s = videoEl.querySelector('source');
      const raw = s ? s.getAttribute('src') : '';
      if (!raw) return '';
      try {
        return new URL(raw, window.location.origin).href;
      } catch {
        return raw;
      }
    }

    function collectGalleryItems(gallery) {
      const items = [];
      const nodes = gallery.querySelectorAll('img, .detail__video-hover, video.detail__slide-still');
      nodes.forEach((n) => {
        if (n.tagName === 'IMG') {
          const src = n.currentSrc || n.getAttribute('src') || '';
          if (src) items.push({ kind: 'image', src, alt: n.getAttribute('alt') || '', el: n });
        } else if (n.classList.contains('detail__video-hover')) {
          const inner = n.querySelector('video');
          const url = inner ? resolveVideoUrl(inner) : '';
          if (url) items.push({ kind: 'video-loop', src: url, el: n });
        } else if (n.tagName === 'VIDEO') {
          const url = resolveVideoUrl(n);
          if (url) items.push({ kind: 'video', src: url, el: n });
        }
      });
      return items;
    }

    function openDetailLightboxFromEventTarget(target) {
      const gallery = target.closest('.detail__gallery');
      if (!gallery) return;
      const img = target.closest('img');
      const hoverWrap = target.closest('.detail__video-hover');
      const still = target.closest('video.detail__slide-still');
      const clicked = (img && gallery.contains(img) && img) ||
        (hoverWrap && gallery.contains(hoverWrap) && hoverWrap) ||
        (still && gallery.contains(still) && still) || null;
      if (!clicked) return;

      videoHoverWraps.forEach((w) => {
        const ve = w.querySelector('video');
        if (ve) {
          try {
            ve.pause();
          } catch {
            /* ignore */
          }
        }
      });

      lightboxItems = collectGalleryItems(gallery);
      let startIdx = lightboxItems.findIndex((it) => it.el === clicked);
      if (startIdx < 0) startIdx = 0;

      const root = ensureDetailLightbox();
      root.hidden = false;
      document.body.classList.add('detail-lightbox-open');
      showLightboxIndex(startIdx);
      const btn = root.querySelector('.detail-lightbox__close');
      if (btn) btn.focus();
    }

    detailMain.addEventListener('click', (e) => {
      const g = e.target.closest('.detail__gallery');
      if (!g) return;
      openDetailLightboxFromEventTarget(e.target);
    });

    // ---- Detail page: PDF preview + fullscreen page viewer ----
    const PDFJS_VERSION = '4.8.69';
    const PDFJS_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + PDFJS_VERSION;
    let pdfjsLibPromise = null;
    let pdfModalScrollHandler = null;

    function loadPdfJs() {
      if (!pdfjsLibPromise) {
        pdfjsLibPromise = import(PDFJS_BASE + '/build/pdf.min.mjs').then((lib) => {
          lib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + '/build/pdf.worker.min.mjs';
          return lib;
        });
      }
      return pdfjsLibPromise;
    }

    function renderPdfPageToCanvas(pdf, pageNumber, canvas, maxCssWidth) {
      return pdf.getPage(pageNumber).then((page) => {
        const baseViewport = page.getViewport({ scale: 1 });
        const cssScale = maxCssWidth / baseViewport.width;
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale: cssScale * dpr });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = Math.floor(viewport.width / dpr) + 'px';
        canvas.style.height = Math.floor(viewport.height / dpr) + 'px';
        return page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      });
    }

    function loadPdfDocument(src) {
      return loadPdfJs().then((pdfjsLib) => pdfjsLib.getDocument(src).promise);
    }

    function ensurePdfModal() {
      let root = document.getElementById('detailPdfModal');
      if (root) return root;
      root = document.createElement('div');
      root.id = 'detailPdfModal';
      root.className = 'detail-pdf-modal';
      root.hidden = true;
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.innerHTML =
        '<div class="detail-pdf-modal__backdrop" aria-hidden="true"></div>' +
        '<button type="button" class="detail-pdf-modal__close" aria-label="Close PDF viewer">&times;</button>' +
        '<div class="detail-pdf-modal__toolbar">' +
          '<span class="detail-pdf-modal__title"></span>' +
          '<span class="detail-pdf-modal__page"></span>' +
        '</div>' +
        '<div class="detail-pdf-modal__scroll"></div>';
      document.body.appendChild(root);
      root.querySelector('.detail-pdf-modal__backdrop').addEventListener('click', closePdfModal);
      root.querySelector('.detail-pdf-modal__close').addEventListener('click', closePdfModal);
      return root;
    }

    function closePdfModal() {
      const root = document.getElementById('detailPdfModal');
      if (!root || root.hidden) return;
      root.hidden = true;
      document.body.classList.remove('detail-pdf-modal-open');
      const scroll = root.querySelector('.detail-pdf-modal__scroll');
      if (scroll) {
        scroll.innerHTML = '';
        if (pdfModalScrollHandler) {
          scroll.removeEventListener('scroll', pdfModalScrollHandler);
          pdfModalScrollHandler = null;
        }
      }
    }

    function updatePdfModalPageIndicator(root, total) {
      const scroll = root.querySelector('.detail-pdf-modal__scroll');
      const label = root.querySelector('.detail-pdf-modal__page');
      if (!scroll || !label || !total) return;
      const wraps = scroll.querySelectorAll('.detail-pdf-modal__page-wrap');
      let current = 1;
      const mid = scroll.scrollTop + scroll.clientHeight * 0.35;
      wraps.forEach((wrap, idx) => {
        if (wrap.offsetTop <= mid) current = idx + 1;
      });
      label.textContent = 'Page ' + current + ' of ' + total;
    }

    function openPdfModal(src, title) {
      const root = ensurePdfModal();
      const scroll = root.querySelector('.detail-pdf-modal__scroll');
      const titleEl = root.querySelector('.detail-pdf-modal__title');
      if (!scroll || !titleEl) return;

      titleEl.textContent = title || 'PDF document';
      scroll.innerHTML = '<p style="padding:2rem;text-align:center;opacity:0.85">Loading PDF…</p>';
      root.hidden = false;
      document.body.classList.add('detail-pdf-modal-open');
      root.querySelector('.detail-pdf-modal__close').focus();

      loadPdfDocument(src).then((pdf) => {
        scroll.innerHTML = '';
        const total = pdf.numPages;
        const maxWidth = Math.min(window.innerWidth - 32, 920);
        const tasks = [];

        for (let i = 1; i <= total; i += 1) {
          const wrap = document.createElement('div');
          wrap.className = 'detail-pdf-modal__page-wrap';
          const canvas = document.createElement('canvas');
          wrap.appendChild(canvas);
          scroll.appendChild(wrap);
          tasks.push(renderPdfPageToCanvas(pdf, i, canvas, maxWidth));
        }

        return Promise.all(tasks).then(() => {
          updatePdfModalPageIndicator(root, total);
          pdfModalScrollHandler = () => updatePdfModalPageIndicator(root, total);
          scroll.addEventListener('scroll', pdfModalScrollHandler, { passive: true });
        });
      }).catch(() => {
        scroll.innerHTML =
          '<p style="padding:2rem;text-align:center">Could not load PDF. ' +
          '<a href="' + src + '" target="_blank" rel="noopener noreferrer" style="color:#fff">Open in new tab</a></p>';
      });
    }

    document.querySelectorAll('.detail__pdf').forEach((block) => {
      const src = block.getAttribute('data-pdf-src');
      const title = block.getAttribute('data-pdf-title') || 'PDF document';
      const canvas = block.querySelector('.detail__pdf__canvas');
      const trigger = block.querySelector('.detail__pdf__trigger');
      const preview = block.querySelector('.detail__pdf__preview');
      if (!src || !canvas || !trigger) return;

      loadPdfDocument(src).then((pdf) => {
        const maxPreviewWidth = preview ? preview.clientWidth || 640 : 640;
        return renderPdfPageToCanvas(pdf, 1, canvas, maxPreviewWidth);
      }).catch(() => {
        trigger.disabled = true;
        trigger.style.cursor = 'not-allowed';
      });

      trigger.addEventListener('click', () => {
        openPdfModal(src, title);
      });
    });

    document.addEventListener('keydown', (ev) => {
      const pdfRoot = document.getElementById('detailPdfModal');
      if (!pdfRoot || pdfRoot.hidden) return;
      if (ev.key === 'Escape') closePdfModal();
    });
  }

  // ---- Detail page: collapsible "About The Project" panel ----
  const ABOUT_PANEL_MS = 460;

  document.querySelectorAll('.detail__about-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const deliverable = btn.closest('.detail__deliverable');
      const layout = deliverable && deliverable.querySelector('.detail__deliverable-layout');
      const panel = document.getElementById(btn.getAttribute('aria-controls') || '');
      const aside = panel && panel.closest('.detail__deliverable-about');
      if (!layout || !panel || !aside) return;

      const open = !layout.classList.contains('detail__deliverable-layout--about-open');

      if (open) {
        aside.hidden = false;
        aside.setAttribute('aria-hidden', 'false');
        void layout.offsetWidth;
        layout.classList.add('detail__deliverable-layout--about-open');
      } else {
        layout.classList.remove('detail__deliverable-layout--about-open');
        aside.setAttribute('aria-hidden', 'true');
        window.setTimeout(() => {
          if (!layout.classList.contains('detail__deliverable-layout--about-open')) {
            aside.hidden = true;
          }
        }, ABOUT_PANEL_MS);
      }

      btn.setAttribute('aria-expanded', open ? 'true' : 'false');

      const icon = btn.querySelector('.detail__about-toggle-icon');
      if (icon) icon.textContent = open ? '\u00d7' : '+';
    });
  });

  // ---- Homepage presentation mode (hero + skills strip only) ----
  const PORTFOLIO_FOCUS_KEY = 'portfolioHeroMarqueeFocus';
  const PORTFOLIO_FOCUS_CLASS = 'portfolio-hero-marquee-focus';

  const isHomePresentationPage = () =>
    Boolean(
      document.getElementById('hero') &&
        document.querySelector('.marquee-strip') &&
        document.getElementById('brands')
    );

  const resetHeroPresentationStyles = () => {
    if (heroContent) {
      heroContent.style.opacity = '';
      heroContent.style.transform = '';
    }
  };

  const setPortfolioPresentationFocus = (on) => {
    if (!isHomePresentationPage()) return;
    document.body.classList.toggle(PORTFOLIO_FOCUS_CLASS, on);
    try {
      if (on) localStorage.setItem(PORTFOLIO_FOCUS_KEY, '1');
      else localStorage.removeItem(PORTFOLIO_FOCUS_KEY);
    } catch {
      /* private / blocked storage */
    }
    if (on) {
      resetHeroPresentationStyles();
      document.body.style.overflow = '';
      window.scrollTo({ top: 0, behavior: 'auto' });
      updateScrollProgress();
    } else {
      resetHeroPresentationStyles();
      handleHeroParallax();
      updateScrollProgress();
    }
  };

  let initialFocus = false;
  try {
    initialFocus = localStorage.getItem(PORTFOLIO_FOCUS_KEY) === '1';
  } catch {
    /* ignore */
  }
  if (initialFocus && isHomePresentationPage()) {
    setPortfolioPresentationFocus(true);
  }
})();
