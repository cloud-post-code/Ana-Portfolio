(() => {
  'use strict';

  // ---- Scroll Reveal (all animation types) ----
  const revealSelectors = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-rotate, .reveal-blur, .reveal-clip, .reveal-flip';
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
    nav.classList.toggle('nav--scrolled', window.scrollY > 60);
  };

  // ---- Hero Parallax Fade on Scroll ----
  const heroContent = document.querySelector('.hero__content');
  const heroBgText = document.querySelector('.hero__bg-text');
  const heroSection = document.querySelector('.hero');

  const handleHeroParallax = () => {
    const scrollY = window.scrollY;
    const heroH = heroSection ? heroSection.offsetHeight : window.innerHeight;

    if (scrollY < heroH) {
      const ratio = scrollY / heroH;

      if (heroContent) {
        heroContent.style.opacity = 1 - ratio * 1.5;
        heroContent.style.transform = `translateY(${scrollY * 0.35}px)`;
      }

      if (heroBgText) {
        heroBgText.style.transform = `translateX(${-scrollY * 0.2}px)`;
        heroBgText.style.opacity = Math.max(0, 0.4 - ratio * 0.5);
      }
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
  const staggerContainers = document.querySelectorAll(
    '.brands__groups, .work__grid, .strengths__grid'
  );

  staggerContainers.forEach((container) => {
    const children = container.querySelectorAll(revealSelectors);
    children.forEach((child, i) => {
      child.style.transitionDelay = `${i * 0.12}s`;
    });
  });

  // ---- Experience Timeline Stagger ----
  const experienceItems = document.querySelectorAll('.experience__item');
  experienceItems.forEach((item, i) => {
    item.style.transitionDelay = `${i * 0.15}s`;
  });

  // ---- Timeline Draw Animation ----
  const timeline = document.querySelector('.experience__timeline');

  if (timeline) {
    const timelineObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            timeline.classList.add('timeline-drawn');
            timelineObserver.unobserve(timeline);
          }
        });
      },
      { threshold: 0.1 }
    );
    timelineObserver.observe(timeline);
  }

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

  // ---- 3D Tilt on Project Cards ----
  const workCards = document.querySelectorAll('.work__card');

  workCards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;

      card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
      card.classList.add('tilt-active');
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.classList.remove('tilt-active');
    });
  });

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

  // ---- Strength Icons: Stagger the Pop Animation ----
  const strengthItems = document.querySelectorAll('.strengths__item');

  strengthItems.forEach((item, i) => {
    const icon = item.querySelector('.strengths__icon');
    if (icon) {
      icon.style.animationDelay = `${i * 0.12 + 0.3}s`;
    }
  });

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
    } else {
      wrap.addEventListener('click', () => {
        if (wrap.classList.contains('detail__video-hover--playing') && !video.paused) {
          reset();
        } else {
          wrap.classList.add('detail__video-hover--playing');
          tryPlay();
        }
      });
    }

    wrap.setAttribute('tabindex', '0');
  });
})();
