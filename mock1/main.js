/* ============================================================
   HAKOBUNE INC. — Main JavaScript
   Scroll animations, navigation, header state
   Shared across HP and all LP pages
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ---- Elements ----
  const header = document.getElementById('header');
  const navToggle = document.getElementById('navToggle');
  const navOverlay = document.getElementById('navOverlay');
  const navLinks = document.querySelectorAll('[data-nav-link]');
  const hero = document.querySelector('.hero') || document.querySelector('.lp-hero');
  const fadeElements = document.querySelectorAll('.fade-in');

  // ---- Hero Load Animation ----
  if (hero) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        hero.classList.add('is-loaded');
      }, 100);
    });
  }

  // ---- Header Scroll State ----
  const handleHeaderScroll = () => {
    if (!header) return;
    const scrollY = window.scrollY;
    if (scrollY > 80) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  };

  window.addEventListener('scroll', handleHeaderScroll, { passive: true });
  handleHeaderScroll();

  // ---- Navigation Toggle ----
  if (navToggle && navOverlay) {
    const toggleNav = () => {
      const isActive = navToggle.classList.toggle('is-active');
      navOverlay.classList.toggle('is-open', isActive);
      document.body.style.overflow = isActive ? 'hidden' : '';

      if (isActive) {
        navToggle.querySelectorAll('span').forEach(span => {
          span.style.background = '#fff';
        });
      } else {
        navToggle.querySelectorAll('span').forEach(span => {
          span.style.background = '';
        });
      }
    };

    navToggle.addEventListener('click', toggleNav);

    // Close menu on link click
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navToggle.classList.remove('is-active');
        navOverlay.classList.remove('is-open');
        document.body.style.overflow = '';
        navToggle.querySelectorAll('span').forEach(span => {
          span.style.background = '';
        });
      });
    });
  }

  // ---- Smooth Scroll ----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      e.preventDefault();
      const target = document.querySelector(targetId);
      if (target) {
        const headerHeight = header ? header.offsetHeight : 0;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ---- Scroll Fade-In (Intersection Observer) ----
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -60px 0px',
    threshold: 0.1
  };

  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  fadeElements.forEach(el => fadeObserver.observe(el));

});
