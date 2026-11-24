(() => {
  const { pick } = window.siteLocale;
  const { register } = window.demoPlayback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function surface(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = 300 * scale;
    canvas.height = 160 * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    return ctx;
  }

  function line(ctx, points, color, width, dash = []) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function dot(ctx, [x, y], radius, fill, stroke) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function background(ctx) {
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, 300, 160);
    ctx.fillStyle = '#dedee4';
    for (let x = 14; x < 300; x += 16) {
      for (let y = 13; y < 152; y += 16) ctx.fillRect(x, y, 1, 1);
    }
  }

  const traceLength = 65;
  const times = Array.from({ length: traceLength }, (_, i) => i / (traceLength - 1));
  const arms = [
    { base: [48, 124], side: -1, outline: '#25252b', inset: '#6e6e79' },
    { base: [252, 124], side: 1, outline: '#555560', inset: '#a5a5af' },
  ];
  const choreography = [
    [0, [100, 58], [220, 70]],
    [.17, [113, 60], [198, 83]],
    [.34, [132, 64], [175, 91]],
    [.5, [151, 73], [155, 94]],
    [.64, [151, 84], [155, 94]],
    [.77, [151, 67], [163, 94]],
    [.9, [114, 58], [193, 83]],
    [1, [100, 58], [220, 70]],
  ];

  function wristsAt(progress) {
    const index = choreography.findIndex(([at], i) => i > 0 && at >= progress);
    const [start, ...from] = choreography[index - 1];
    const [end, ...to] = choreography[index];
    const u = (progress - start) / (end - start);
    const ease = u * u * (3 - 2 * u);
    return from.map((point, i) => point.map((value, axis) => value + (to[i][axis] - value) * ease));
  }

  function elbowAt({ base, side }, [x, y]) {
    const shoulderLength = 65;
    const forearmLength = 59;
    const dx = x - base[0];
    const dy = y - base[1];
    const distance = Math.hypot(dx, dy);
    const cosine = clamp((shoulderLength ** 2 + distance ** 2 - forearmLength ** 2)
      / (2 * shoulderLength * distance), -1, 1);
    const angle = Math.atan2(dy, dx) + side * Math.acos(cosine);
    return [base[0] + shoulderLength * Math.cos(angle), base[1] + shoulderLength * Math.sin(angle)];
  }

  function drawArm(ctx, arm, wrist) {
    const [baseX, baseY] = arm.base;
    const elbow = elbowAt(arm, wrist);
    ctx.fillStyle = arm.outline;
    ctx.fillRect(baseX - 16, 136, 32, 6);
    ctx.fillRect(baseX - 7, baseY + 3, 14, 13);
    strokeArm(ctx, [arm.base, elbow, wrist], arm);
    for (const [point, radius] of [[arm.base, 8], [elbow, 7], [wrist, 5]]) {
      dot(ctx, point, radius, arm.outline, '#18181b');
      dot(ctx, point, 2, '#e1e1e7', arm.outline);
    }
    const [x, y] = wrist;
    line(ctx, [[x, y], [x, y + 9]], arm.outline, 4);
    line(ctx, [[x - 8, y + 9], [x + 8, y + 9]], arm.outline, 3);
    line(ctx, [[x - 8, y + 9], [x - 8, y + 16], [x - 5, y + 16]], arm.outline, 2);
    line(ctx, [[x + 8, y + 9], [x + 8, y + 16], [x + 5, y + 16]], arm.outline, 2);
  }

  function strokeArm(ctx, points, arm) {
    line(ctx, points, arm.outline, 13);
    line(ctx, points, arm.inset, 5);
  }

  function drawActions(ctx, progress) {
    if (!ctx) return;
    background(ctx);
    line(ctx, [[23, 142], [277, 142]], '#d4d4d8', 1);
    const [left, right] = wristsAt(progress);
    drawArm(ctx, arms[0], left);
    drawArm(ctx, arms[1], right);

    const [rx, ry] = right;
    line(ctx, [[rx - 5, ry + 13], [rx - 4, ry + 25], [rx + 4, ry + 25], [rx + 5, ry + 13]], '#555560', 1.8);
    line(ctx, [[rx - 3, ry + 21], [rx + 3, ry + 21]], '#8d8d97', 1.2);
    const [lx, ly] = left;
    line(ctx, [[lx, ly + 8], [lx, ly + 20]], '#25252b', 4);
    line(ctx, [[lx, ly + 20], [lx, ly + 30]], '#686873', 1.5);
  }


  for (const flow of document.querySelectorAll('[data-flow]')) {
    const ctx = surface(flow.querySelector('[data-action-scene]'));
    const steps = [...flow.querySelectorAll('[data-flow-step]')];
    const images = [...flow.querySelectorAll('[data-model-frame]')];
    let activeStage = -1;
    let lastFrame = -1;
    const playback = register(flow, 6350, (position) => {
      const ms = position * 6350;
      const stage = ms < 330 ? 0 : ms < 850 ? 1 : ms < 5750 ? 2 : 3;
      if (stage !== activeStage) {
        steps.forEach((step) => step.classList.toggle('is-active', Number(step.dataset.flowStep) === stage));
        activeStage = stage;
      }
      const progress = clamp((ms - 850) / 4900, 0, 1);
      drawActions(ctx, progress);
      const frame = stage < 2 ? 2 : 2 + Math.min(5, Math.floor(progress * 6));
      if (frame !== lastFrame) {
        images.forEach((image) => {
          image.src = 'assets/media/illustration/frame-' + (frame + Number(image.dataset.modelFrame)) + '.webp';
        });
        lastFrame = frame;
      }
    });
    document.querySelector('[data-replay="' + flow.id + '"]').addEventListener('click', playback.replay);
  }

  const demo = document.querySelector('.kinematics-demo');
  const ctx = surface(document.getElementById('kinematic-scene'));
  const progress = document.getElementById('kinematic-progress');
  const eeValue = document.getElementById('kinematic-ee');
  const jointValue = document.getElementById('kinematic-joint');
  const conversion = document.getElementById('kinematic-conversion');
  const note = document.getElementById('kinematic-note');
  const modes = [...demo.querySelectorAll('[data-kinematic-mode]')];
  const readouts = [...demo.querySelectorAll('[data-kinematic-value]')];
  const origin = [53, 128];
  const upper = 84;
  const lower = 81;
  let mode = 'ee';
  let selectedMode = false;

  function poseAt(t) {
    return [118 + 88 * t, 111 - 33 * t - 28 * Math.sin(Math.PI * t)];
  }

  function inverse([x, y]) {
    const dx = x - origin[0];
    const dy = origin[1] - y;
    const cosine = clamp((dx * dx + dy * dy - upper ** 2 - lower ** 2) / (2 * upper * lower), -1, 1);
    const q2 = Math.acos(cosine);
    const q1 = Math.atan2(dy, dx) - Math.atan2(lower * Math.sin(q2), upper + lower * Math.cos(q2));
    return [q1, q2];
  }

  function forward([q1, q2]) {
    return [
      origin[0] + upper * Math.cos(q1) + lower * Math.cos(q1 + q2),
      origin[1] - upper * Math.sin(q1) - lower * Math.sin(q1 + q2),
    ];
  }

  const path = times.map(poseAt);
  const equivalentJoints = Array.from({ length: 101 }, (_, index) => inverse(poseAt(index / 100)));
  note.setAttribute('aria-live', 'off');

  function drawPose() {
    const index = Number(progress.value);
    const amount = index / 100;
    const target = poseAt(amount);
    const joints = mode === 'ee' ? inverse(target) : equivalentJoints[index];
    const tool = mode === 'ee' ? target : forward(joints);
    eeValue.textContent = 'x ' + ((tool[0] - origin[0]) / 100).toFixed(2)
      + ' · y ' + ((origin[1] - tool[1]) / 100).toFixed(2);
    jointValue.textContent = joints.map((angle, i) => 'q' + (i + 1) + ' ' + (angle * 180 / Math.PI).toFixed(1) + '°').join(' · ');
    if (!ctx) return;
    background(ctx);
    line(ctx, [origin, [239, origin[1]]], '#d4d4d8', 1);
    line(ctx, [origin, [origin[0], 32]], '#d4d4d8', 1);
    line(ctx, path, '#a1a1aa', 2, [3, 5]);
    line(ctx, [...path.slice(0, Math.floor(amount * (traceLength - 1)) + 1), tool], '#25252b', 3.5);
    dot(ctx, path[0], 4, '#fafafa', '#71717a');
    dot(ctx, path[path.length - 1], 4, '#fafafa', '#71717a');
    dot(ctx, tool, 6, '#25252b', '#fafafa');
  }

  function describe() {
    for (const button of modes) button.setAttribute('aria-pressed', String(button.dataset.kinematicMode === mode));
    for (const box of readouts) box.classList.toggle('is-source', box.dataset.kinematicValue === mode);
    conversion.textContent = mode === 'ee' ? 'IK →' : '← FK';
    note.textContent = mode === 'ee'
      ? pick('Position to joint angles with IK. The marker follows the same path.', '由末端位置经 IK 得到关节角。位置点沿同一条轨迹移动。')
      : pick('Joint angles to position with FK. The marker follows the same path.', '由关节角经 FK 恢复末端位置。位置点沿同一条轨迹移动。');
  }

  const kinematics = register(demo, 8400, (position) => {
    const next = !selectedMode && position >= .5 ? 'joint' : !selectedMode ? 'ee' : mode;
    if (next !== mode) {
      mode = next;
      describe();
      drawPose();
    }
    const value = Math.round((1 - Math.cos(position * 2 * Math.PI)) * 50);
    if (Number(progress.value) === value) return;
    progress.value = value;
    drawPose();
  });

  for (const button of modes) {
    button.addEventListener('click', () => {
      selectedMode = true;
      mode = button.dataset.kinematicMode;
      note.setAttribute('aria-live', 'polite');
      describe();
      drawPose();
    });
  }
  progress.addEventListener('input', () => {
    kinematics.hold();
    drawPose();
  });
  window.addEventListener('site-language-change', describe);
  describe();
  drawPose();
})();
