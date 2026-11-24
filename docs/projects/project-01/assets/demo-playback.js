(() => {
  const toggle = document.getElementById('model-pause');
  const { pick } = window.siteLocale;
  const demos = new Map();
  let paused = false;
  let requestedFrame = 0;
  let previousTime = 0;
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const entry of entries) demos.get(entry.target).visible = entry.isIntersecting;
    schedule();
  }, { threshold: .1 }) : null;

  function shouldPlay(demo) {
    return demo.visible && !demo.held && (!paused || demo.replaying);
  }

  function advance(now) {
    requestedFrame = 0;
    const delta = previousTime ? Math.min(now - previousTime, 50) : 0;
    previousTime = now;
    for (const demo of demos.values()) {
      if (!shouldPlay(demo)) continue;
      demo.elapsed += delta;
      if (demo.elapsed >= demo.duration) {
        demo.elapsed = paused ? demo.duration : demo.elapsed % demo.duration;
        demo.replaying = false;
      }
      demo.render(demo.elapsed / demo.duration);
    }
    if (!schedule()) previousTime = 0;
  }

  function schedule() {
    if (requestedFrame) return true;
    if (![...demos.values()].some(shouldPlay)) return false;
    requestedFrame = requestAnimationFrame(advance);
    return true;
  }

  function register(element, duration, render) {
    const demo = { duration, render, visible: !observer, held: false, replaying: false, elapsed: 0 };
    demos.set(element, demo);
    render(0);
    observer?.observe(element);
    schedule();

    return {
      hold() {
        demo.held = true;
        demo.replaying = false;
      },
      replay() {
        demo.elapsed = 0;
        demo.held = false;
        demo.replaying = true;
        render(0);
        schedule();
      },
    };
  }

  function describe() {
    document.documentElement.toggleAttribute('data-demo-paused', paused);
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? pick('Play animations', '播放动画') : pick('Pause animations', '暂停动画');
  }

  toggle.addEventListener('click', () => {
    paused = !paused;
    for (const demo of demos.values()) {
      demo.replaying = false;
      if (!paused) demo.held = false;
    }
    describe();
    schedule();
  });
  window.addEventListener('site-language-change', describe);
  window.demoPlayback = { register };
  describe();
})();
