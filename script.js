/* Progressive enhancement: the portfolio remains readable without JavaScript. */
(() => {
  'use strict';
  document.documentElement.classList.add('js-ready');

  const controller = new AbortController();
  const cleanups = [];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const isTurkish = document.documentElement.lang.toLowerCase().startsWith('tr');
  const on = (target, event, handler, options = {}) => {
    target?.addEventListener(event, handler, { ...options, signal: controller.signal });
  };

  function initYear() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-year]').forEach((element) => {
      element.textContent = year;
    });
  }

  function initMenu() {
    const toggle = document.querySelector('[data-menu-toggle]');
    const navigation = toggle && document.getElementById(toggle.getAttribute('aria-controls'));
    if (!toggle || !navigation) return;

    const setOpen = (open, returnFocus = false) => {
      toggle.setAttribute('aria-expanded', String(open));
      navigation.classList.toggle('is-open', open);
      if (returnFocus) toggle.focus();
    };
    on(toggle, 'click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    on(navigation, 'click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });
    on(document, 'click', (event) => {
      if (!navigation.contains(event.target) && !toggle.contains(event.target)) setOpen(false);
    });
    on(document, 'keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false, true);
      }
    });
    // A mobile menu should not remain expanded after changing viewport size.
    const desktop = window.matchMedia('(min-width: 769px)');
    on(desktop, 'change', () => setOpen(false));
    setOpen(false);
  }

  function initCodeTabs() {
    const tabs = [...document.querySelectorAll('[data-code-tab]')];
    if (!tabs.length) return;

    const activate = (selectedTab, moveFocus = false) => {
      tabs.forEach((tab) => {
        const active = tab === selectedTab;
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        if (panel) panel.hidden = !active;
      });
      const status = document.querySelector('[data-copy-status]');
      if (status) status.textContent = '';
      if (moveFocus) selectedTab.focus();
    };

    tabs.forEach((tab, index) => {
      on(tab, 'click', () => activate(tab));
      on(tab, 'keydown', (event) => {
        let next = index;
        switch (event.key) {
          case 'ArrowRight': next = (index + 1) % tabs.length; break;
          case 'ArrowLeft': next = (index - 1 + tabs.length) % tabs.length; break;
          case 'Home': next = 0; break;
          case 'End': next = tabs.length - 1; break;
          default: return;
        }
        event.preventDefault();
        activate(tabs[next], true);
      });
    });
    activate(tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0]);
  }

  function legacyCopy(text) {
    if (typeof document.execCommand !== 'function') return false;
    const previousFocus = document.activeElement;
    const selection = window.getSelection();
    const savedRanges = [];
    if (selection) {
      for (let index = 0; index < selection.rangeCount; index += 1) {
        savedRanges.push(selection.getRangeAt(index).cloneRange());
      }
    }
    const field = document.createElement('textarea');
    field.value = text;
    field.readOnly = true;
    field.tabIndex = -1;
    field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
    document.body.append(field);
    let copied = false;
    try {
      field.focus({ preventScroll: true });
      field.select();
      copied = document.execCommand('copy') === true;
    } catch {
      copied = false;
    } finally {
      field.remove();
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
      if (selection && savedRanges.length) {
        selection.removeAllRanges();
        savedRanges.forEach((range) => selection.addRange(range));
      }
    }
    return copied;
  }

  function initCopy() {
    const button = document.querySelector('[data-copy-code]');
    const status = document.querySelector('[data-copy-status]');
    if (!button) return;
    let statusTimer = 0;
    cleanups.push(() => clearTimeout(statusTimer));

    on(button, 'click', async () => {
      const panel = document.querySelector('.code-panel:not([hidden])');
      const code = panel?.querySelector('code') || panel;
      if (!code || button.disabled) return;
      const text = code.innerText.trim();
      if (!text) return;
      button.disabled = true;
      clearTimeout(statusTimer);
      if (status) status.textContent = '';
      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          try {
            await navigator.clipboard.writeText(text);
            copied = true;
          } catch {
            copied = legacyCopy(text);
          }
        } else {
          copied = legacyCopy(text);
        }
      } finally {
        button.disabled = false;
        if (status) {
          status.textContent = copied
            ? (isTurkish ? 'Kod panoya kopyalandı.' : 'Code copied to clipboard.')
            : (isTurkish
              ? 'Kopyalanamadı. Kodu seçip manuel olarak kopyalayabilirsin.'
              : 'Copy failed. Select the code and copy it manually.');
          if (copied) statusTimer = setTimeout(() => { status.textContent = ''; }, 2800);
        }
      }
    });
  }

  function initTilt() {
    document.querySelectorAll('[data-tilt]').forEach((card) => {
      let frame = 0;
      let pointer = null;
      let hovered = false;
      const allowed = () => finePointer.matches && !motionPreference.matches;
      const clearTilt = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        pointer = null;
        card.style.setProperty('--rotate-x', '0deg');
        card.style.setProperty('--rotate-y', '0deg');
        card.style.setProperty('--glow-x', '50%');
        card.style.setProperty('--glow-y', '50%');
      };
      const updateInteraction = () => {
        card.classList.toggle('is-interacting', hovered || card.contains(document.activeElement));
      };
      const render = () => {
        frame = 0;
        if (!pointer || !allowed()) return;
        const bounds = card.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const x = Math.max(0, Math.min(1, (pointer.x - bounds.left) / bounds.width));
        const y = Math.max(0, Math.min(1, (pointer.y - bounds.top) / bounds.height));
        card.style.setProperty('--rotate-x', `${((0.5 - y) * 8).toFixed(2)}deg`);
        card.style.setProperty('--rotate-y', `${((x - 0.5) * 8).toFixed(2)}deg`);
        card.style.setProperty('--glow-x', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--glow-y', `${(y * 100).toFixed(1)}%`);
      };
      on(card, 'pointerenter', (event) => {
        if (!finePointer.matches || event.pointerType === 'touch') return;
        hovered = true;
        updateInteraction();
      });
      on(card, 'pointermove', (event) => {
        if (!allowed() || event.pointerType === 'touch') return;
        pointer = { x: event.clientX, y: event.clientY };
        if (!frame) frame = requestAnimationFrame(render);
      }, { passive: true });
      const exit = () => {
        hovered = false;
        clearTilt();
        updateInteraction();
      };
      on(card, 'pointerleave', exit);
      on(card, 'pointercancel', exit);
      on(card, 'focusin', updateInteraction);
      on(card, 'focusout', (event) => {
        card.classList.toggle('is-interacting', hovered || card.contains(event.relatedTarget));
      });
      on(motionPreference, 'change', clearTilt);
      on(finePointer, 'change', exit);
      on(window, 'blur', exit);
      cleanups.push(clearTilt);
    });
  }

  function initReveal() {
    const elements = [...document.querySelectorAll('.reveal')];
    if (!elements.length || !('IntersectionObserver' in window)) return;
    let observer;
    const configure = () => {
      observer?.disconnect();
      if (motionPreference.matches) {
        document.documentElement.classList.remove('reveal-ready');
        elements.forEach((element) => element.classList.add('is-visible'));
        return;
      }
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px 24px 0px' });
      document.documentElement.classList.add('reveal-ready');
      elements.forEach((element) => {
        if (!element.classList.contains('is-visible')) observer.observe(element);
      });
    };
    configure();
    on(motionPreference, 'change', configure);
    cleanups.push(() => observer?.disconnect());
  }

  function initGallery() {
    const links = [...document.querySelectorAll('[data-gallery-item]')];
    const dialog = document.querySelector('[data-gallery-dialog]');
    if (!links.length || !dialog || typeof dialog.showModal !== 'function') return;
    const image = dialog.querySelector('[data-gallery-image]');
    const title = dialog.querySelector('[data-gallery-title]');
    const count = dialog.querySelector('[data-gallery-count]');
    const close = dialog.querySelector('[data-gallery-close]');
    const previous = dialog.querySelector('[data-gallery-prev]');
    const next = dialog.querySelector('[data-gallery-next]');
    let current = 0;

    const show = (index) => {
      current = (index + links.length) % links.length;
      const link = links[current];
      const thumbnail = link.querySelector('img');
      image.src = link.href;
      image.alt = thumbnail?.alt || '';
      title.textContent = link.querySelector('.gallery-caption strong')?.textContent || '';
      count.textContent = `${String(current + 1).padStart(2, '0')} / ${String(links.length).padStart(2, '0')}`;
    };

    links.forEach((link, index) => {
      on(link, 'click', (event) => {
        event.preventDefault();
        show(index);
        dialog.showModal();
        close.focus();
      });
    });
    on(close, 'click', () => dialog.close());
    on(previous, 'click', () => show(current - 1));
    on(next, 'click', () => show(current + 1));
    on(dialog, 'click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    on(dialog, 'keydown', (event) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); show(current - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); show(current + 1); }
    });
  }

  function initAmbient() {
    const canvas = document.getElementById('ambient');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let width = 0;
    let height = 0;
    let dots = [];
    let frame = 0;
    let previousTime = 0;
    let resizeFrame = 0;
    const palette = ['99, 132, 255', '152, 100, 255', '89, 206, 255'];

    const draw = (elapsed = 0) => {
      context.clearRect(0, 0, width, height);
      dots.forEach((dot) => {
        dot.x = (dot.x + dot.vx * elapsed + width) % width;
        dot.y = (dot.y + dot.vy * elapsed + height) % height;
        context.beginPath();
        context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(${dot.color}, ${dot.opacity})`;
        context.fill();
      });
    };

    const tick = (time) => {
      if (document.hidden || motionPreference.matches) {
        frame = 0;
        return;
      }
      if (!previousTime) previousTime = time;
      const elapsed = time - previousTime;
      if (elapsed >= 1000 / 30) {
        draw(Math.min(elapsed, 80) / 1000);
        previousTime = time;
      }
      frame = requestAnimationFrame(tick);
    };

    const updateAnimation = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      draw();
      if (!document.hidden && !motionPreference.matches) frame = requestAnimationFrame(tick);
    };

    const resize = () => {
      resizeFrame = 0;
      width = Math.max(1, canvas.clientWidth || window.innerWidth);
      height = Math.max(1, canvas.clientHeight || window.innerHeight);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.round(Math.min(45, Math.max(18, width * height / 26000)));
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 8,
        vy: -(Math.random() * 7 + 3),
        radius: Math.random() * 1.15 + 0.5,
        opacity: Math.random() * 0.26 + 0.15,
        color: palette[Math.floor(Math.random() * palette.length)],
      }));
      draw();
    };

    on(window, 'resize', () => {
      if (!resizeFrame) resizeFrame = requestAnimationFrame(resize);
    }, { passive: true });
    on(document, 'visibilitychange', updateAnimation);
    on(motionPreference, 'change', updateAnimation);
    on(window, 'pageshow', updateAnimation);
    on(window, 'pagehide', () => {
      cancelAnimationFrame(frame);
      frame = 0;
    });
    cleanups.push(() => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resizeFrame);
    });
    resize();
    updateAnimation();
  }

  initYear();
  initMenu();
  initCodeTabs();
  initCopy();
  initTilt();
  initReveal();
  initGallery();
  initAmbient();

  on(window, 'pagehide', (event) => {
    if (event.persisted) return;
    cleanups.forEach((cleanup) => cleanup());
    controller.abort();
  });
})();
