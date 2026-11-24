(() => {
  const { pick } = window.siteLocale;
  const { register } = window.demoPlayback;
  const clean = document.querySelector('[data-clean]');
  const filmstrip = document.getElementById('filmstrip');
  const cleanToggle = document.getElementById('clean-toggle');
  const cleanOutput = document.getElementById('clean-count');
  const frames = [1, 2, 3, 4, 4, 4, 4, 4, 5, 6, 7, 8];
  frames.forEach((number, index) => {
    const cell = document.createElement('div');
    cell.className = 'film-frame';
    cell.classList.toggle('is-pause', index >= 4 && index <= 7);
    const image = new Image();
    image.src = 'assets/media/illustration/frame-' + number + '.webp';
    image.loading = 'lazy';
    image.alt = '';
    cell.append(image);
    filmstrip.append(cell);
  });

  function describeCleaning() {
    const cleaned = clean.classList.contains('is-clean');
    cleanToggle.setAttribute('aria-pressed', String(cleaned));
    cleanOutput.textContent = cleaned ? pick('8 frames kept', '保留 8 帧') : pick('12 illustrative frames', '12 帧示意');
  }
  function setCleaning(active) {
    if (clean.classList.contains('is-clean') === active) return;
    clean.classList.toggle('is-clean', active);
    describeCleaning();
  }
  cleanOutput.setAttribute('aria-live', 'off');
  const cleaning = register(clean, 6500, (phase) => setCleaning(phase >= .38));
  cleanToggle.addEventListener('click', () => {
    cleaning.hold();
    cleanOutput.setAttribute('aria-live', 'polite');
    setCleaning(!clean.classList.contains('is-clean'));
  });

  const canvas = document.getElementById('smooth-chart');
  const slider = document.getElementById('smooth-level');
  const smoothValue = document.getElementById('smooth-value');
  const context = canvas.getContext('2d');
  const raw = [12, 18, 29, 24, 40, 42, 55, 46, 65, 59, 68, 80];
  const stencil = [-1, 3, -3, 1];
  const penalty = raw.map(() => Array(raw.length).fill(0));
  for (let start = 0; start <= raw.length - stencil.length; start += 1) {
    stencil.forEach((left, i) => {
      stencil.forEach((right, j) => {
        penalty[start + i][start + j] += left * right;
      });
    });
  }

  function minimumJerkPath(amount) {
    const path = [...raw];
    const weight = 8 * amount ** 2;
    const maxDeviation = 9;
    // Coordinate descent on squared tracking error plus squared third differences.
    // Keep measured endpoints fixed and clamp every free point to the allowed band.
    for (let pass = 0; pass < 56; pass += 1) {
      for (let i = 1; i < path.length - 1; i += 1) {
        const coupling = penalty[i].reduce((sum, coefficient, j) => (
          j === i ? sum : sum + coefficient * path[j]
        ), 0);
        const estimate = (raw[i] - weight * coupling) / (1 + weight * penalty[i][i]);
        path[i] = Math.max(raw[i] - maxDeviation, Math.min(raw[i] + maxDeviation, estimate));
      }
    }
    return path;
  }

  function drawTrajectory() {
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    smoothValue.value = slider.value + '%';
    if (!context || width === 0 || height === 0) return;

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const x = (i) => 9 + i * (width - 18) / (raw.length - 1);
    const y = (value) => height - 8 - value * (height - 16) / 87;

    context.lineWidth = 1;
    context.strokeStyle = '#e4e4e7';
    for (const level of [14, 34, 54, 74]) {
      context.beginPath();
      context.moveTo(0, y(level));
      context.lineTo(width, y(level));
      context.stroke();
    }

    function stroke(line, color, lineWidth, dash = []) {
      context.lineWidth = lineWidth;
      context.strokeStyle = color;
      context.lineJoin = 'round';
      context.setLineDash(dash);
      context.beginPath();
      line.forEach((value, index) => {
        if (index === 0) context.moveTo(x(index), y(value));
        else context.lineTo(x(index), y(value));
      });
      context.stroke();
      context.setLineDash([]);
    }

    const amount = Number(slider.value) / 100;
    const display = minimumJerkPath(amount);
    stroke(raw, '#777780', 1.5, [4, 3]);
    stroke(display, '#18181b', 2.75);
    for (const index of [0, raw.length - 1]) {
      context.beginPath();
      context.arc(x(index), y(raw[index]), 4, 0, Math.PI * 2);
      context.fillStyle = '#18181b';
      context.fill();
    }
  }

  const smoothing = register(canvas.closest('.smooth-demo'), 6200, (phase) => {
    const amount = Math.round(10 + (1 - Math.cos(phase * 2 * Math.PI)) * 45);
    if (Number(slider.value) === amount) return;
    slider.value = amount;
    drawTrajectory();
  });
  slider.addEventListener('input', () => {
    smoothing.hold();
    drawTrajectory();
  });
  if ('ResizeObserver' in window) new ResizeObserver(drawTrajectory).observe(canvas);
  else window.addEventListener('resize', drawTrajectory);

  const timing = document.getElementById('timing-chart');
  const timingNote = document.getElementById('timing-status');
  const modes = [...document.querySelectorAll('[data-mode]')];
  let mode = 'overlap';

  function describeTiming() {
    timing.classList.toggle('is-serial', mode === 'serial');
    for (const button of modes) button.setAttribute('aria-pressed', String(mode === button.dataset.mode));
    timingNote.textContent = mode === 'serial'
      ? pick('The current action ends before camera feedback and the next prediction are available.', '当前动作结束后，才等待相机反馈并计算下一段动作。')
      : pick('FDM forecasts during execution. Camera feedback then corrects the history for later predictions.', 'FDM 在执行期间前瞻。随后用相机反馈校正后续预测所用的历史。');
  }
  timingNote.setAttribute('aria-live', 'off');
  function setTiming(next) {
    if (next === mode) return;
    mode = next;
    describeTiming();
  }
  const scheduling = register(timing, 9200, (phase) => setTiming(phase >= .6 ? 'serial' : 'overlap'));
  for (const button of modes) {
    button.addEventListener('click', () => {
      scheduling.hold();
      timingNote.setAttribute('aria-live', 'polite');
      setTiming(button.dataset.mode);
    });
  }

  const contextToggle = document.getElementById('context-toggle');
  const slicingDemo = contextToggle.closest('.slicing-demo');
  function setContext(expanded) {
    if (slicingDemo.classList.contains('is-expanded') === expanded) return;
    slicingDemo.classList.toggle('is-expanded', expanded);
    contextToggle.setAttribute('aria-pressed', String(expanded));
  }
  const slicing = register(slicingDemo, 6900, (phase) => setContext(phase >= .4));
  contextToggle.addEventListener('click', () => {
    slicing.hold();
    setContext(!slicingDemo.classList.contains('is-expanded'));
  });

  function translate() {
    describeCleaning();
    describeTiming();
  }
  window.addEventListener('site-language-change', translate);
  translate();
  drawTrajectory();
})();
