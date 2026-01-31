/* ==========================================================================
   LINKPAD - HOMEPAGE INTERACTIONS
   ========================================================================== */

/**
 * Wait for DOM to be ready
 */
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Initialize all modules
  initThemeToggle();
  initCarousel();
  initScrollAnimations();
  initSmoothScroll();
  initScrollToTop();
});

/* ========== Theme Toggle ========== */
function initThemeToggle() {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  // Check for saved theme preference
  const savedTheme = localStorage.getItem('linkpad-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Apply saved theme or system preference
  if (savedTheme === 'light' || (!savedTheme && !prefersDark)) {
    document.body.classList.add('light-mode');
    updateThemeIcon(true);
  }

  toggle.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-mode');
    localStorage.setItem('linkpad-theme', isLight ? 'light' : 'dark');
    updateThemeIcon(isLight);

    // Re-render icons after theme change
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  });
}

function updateThemeIcon(isLight) {
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  const icon = toggle.querySelector('i');
  if (icon) {
    icon.setAttribute('data-lucide', isLight ? 'sun' : 'moon');
  }
}

/* ========== Carousel (Smooth Scroll) ========== */
/* ========== Carousel (Infinite/Cyclic) ========== */
function initCarousel() {
  const track = document.querySelector('.carousel__track');
  const prevBtn = document.getElementById('carousel-prev');
  const nextBtn = document.getElementById('carousel-next');

  if (!track || !prevBtn || !nextBtn) return;

  const items = Array.from(track.querySelectorAll('.carousel__item'));
  if (!items.length) return;

  // Clone items for infinite effect
  items.forEach((item) => {
    const clone = item.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true'); // Hide clones from screen readers
    track.appendChild(clone);
  });

  const getScrollAmount = () => {
    const item = items[0];
    const style = window.getComputedStyle(track);
    const gap = parseFloat(style.gap) || 24;
    return item.offsetWidth + gap;
  };

  const handleScroll = () => {
    const { scrollLeft, scrollWidth } = track;
    const halfWidth = scrollWidth / 2;

    // Silent reset when reaching the cloned set or start
    if (scrollLeft >= halfWidth) {
      track.style.scrollBehavior = 'auto'; // Disable smoothing for instant jump
      track.scrollLeft -= halfWidth;
      track.style.scrollBehavior = ''; // Re-enable
    } else if (scrollLeft <= 0) {
      // Optional: Handle backward scroll to end (if needed)
      // For now, simple right-ward flow is main focus
    }
  };

  track.addEventListener('scroll', handleScroll);

  prevBtn.addEventListener('click', () => {
    const { scrollLeft, scrollWidth } = track;
    const halfWidth = scrollWidth / 2;

    // If at start, jump to middle (clone start) then scroll back
    if (scrollLeft <= 10) {
      track.style.scrollBehavior = 'auto';
      track.scrollLeft = halfWidth;
      track.style.scrollBehavior = '';
      requestAnimationFrame(() => {
        track.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
      });
    } else {
      track.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
    }
  });

  nextBtn.addEventListener('click', () => {
    track.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
  });
}

/* ========== Scroll Animations ========== */
function initScrollAnimations() {
  // Select elements to animate on scroll
  const animateElements = document.querySelectorAll(
    '.card, .review-card, .faq__item',
  );

  if (!animateElements.length) return;

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  if (prefersReducedMotion) {
    // If user prefers reduced motion, just show elements without animation
    animateElements.forEach((el) => el.classList.add('animate-in'));
    return;
  }

  // Create intersection observer
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          // Add staggered delay based on visible index
          setTimeout(() => {
            entry.target.classList.add('animate-in');
          }, index * 100);

          // Unobserve after animation
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    },
  );

  // Start observing
  animateElements.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    observer.observe(el);
  });
}

/* ========== Smooth Scroll ========== */
function initSmoothScroll() {
  const navLinks = document.querySelectorAll('a[href^="#"]');

  navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');

      // Skip if it's just "#" (handled by scroll-to-top)
      if (href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();

      // Calculate offset for sticky header
      const headerHeight =
        document.querySelector('.header')?.offsetHeight || 80;
      const targetPosition = target.offsetTop - headerHeight - 20;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth',
      });

      // Update URL without scrolling
      history.pushState(null, '', href);

      // Focus the target for accessibility
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  });
}

/* ========== Scroll to Top ========== */
function initScrollToTop() {
  const scrollToTopBtn = document.getElementById('scroll-to-top');
  if (!scrollToTopBtn) return;

  scrollToTopBtn.addEventListener('click', (e) => {
    e.preventDefault();

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });

    // Update URL to remove hash
    history.pushState(null, '', window.location.pathname);
  });
}
