(() => {
  const { pick } = window.siteLocale;
  const groups = window.projectMedia;
  const views = [
    { key: 'head', name: ['Head', '头部'] },
    { key: 'left-wrist', name: ['Left wrist', '左腕'] },
    { key: 'right-wrist', name: ['Right wrist', '右腕'] }
  ];
  const byId = (id) => document.getElementById(id);
  const skills = byId('skill-list');
  const attempts = byId('attempt-list');
  const player = byId('player');
  const grid = byId('video-grid');
  const playButton = byId('play-button');
  const playhead = byId('playhead');
  const timecode = byId('timecode');
  const error = byId('play-error');
  const previous = byId('previous-attempt');
  const next = byId('next-attempt');
  const filters = [...document.querySelectorAll('[data-result]')];
  const cameraButtons = [...document.querySelectorAll('[data-view]')];

  let groupIndex = 0;
  let resultFilter = 'all';
  let currentTrial = 1;
  let viewMode = matchMedia('(max-width: 520px)').matches ? 'right-wrist' : 'all';
  let cameras = [];
  let shownTrials = [];
  let playbackWanted = false;
  let playbackRequest = 0;
  let frameRequest = 0;
  let time = 0;
  let duration = 0;

  const group = () => groups[groupIndex];
  const padded = (number) => String(number).padStart(2, '0');
  const trialName = (number) => pick('Trial ' + padded(number), '第 ' + padded(number) + ' 次');
  const failureNote = (number) => group().failures[number];
  const outcome = (number) => failureNote(number) ? pick('Failed', '失败') : pick('Passed', '成功');

  function pressed(button, selected) {
    button.setAttribute('aria-pressed', String(selected));
  }

  function syncDuration() {
    const ready = cameras.map(({ video }) => video.duration).filter(Number.isFinite);
    duration = ready.length ? Math.min(...ready) : 0;
    playhead.max = duration || 1;
    playhead.disabled = duration <= 0;
  }

  function formatTime(seconds) {
    const ticks = Math.floor(Math.max(0, seconds) * 10 + .00001);
    return Math.floor(ticks / 600) + ':' + padded(Math.floor(ticks / 10) % 60) + '.' + ticks % 10;
  }

  function updateTransport() {
    const label = playbackWanted ? pick('Pause', '暂停') : pick('Play', '播放');
    playButton.textContent = label;
    playButton.setAttribute('aria-label', label);
    playhead.value = Math.min(time, duration);
    timecode.value = formatTime(Math.min(time, duration)) + ' / ' + formatTime(duration);
  }

  function seek(seconds) {
    time = Math.max(0, duration > 0 ? Math.min(duration, seconds) : seconds);
    for (const { video } of cameras) {
      if (Number.isFinite(video.duration)) video.currentTime = Math.min(time, video.duration);
    }
    updateTransport();
  }

  function pause() {
    playbackWanted = false;
    playbackRequest += 1;
    cancelAnimationFrame(frameRequest);
    cameras.forEach(({ video }) => video.pause());
    updateTransport();
  }

  function tick() {
    if (!playbackWanted || !cameras.length) return;
    const master = cameras[0].video;
    time = master.currentTime;
    if (master.ended) {
      pause();
      return;
    }
    for (const { video } of cameras.slice(1)) {
      if (video.readyState >= 2 && !video.seeking && !video.ended && Math.abs(video.currentTime - time) > .16) {
        video.currentTime = Math.min(time, video.duration);
      }
    }
    updateTransport();
    frameRequest = requestAnimationFrame(tick);
  }

  function showError() {
    error.hidden = false;
    error.textContent = pick('Playback is unavailable. Open or download an individual MP4 below its camera view.', '播放出现问题。可通过对应视角下方的 MP4 链接单独打开或下载。');
  }

  async function play() {
    if (!cameras.length) return;
    error.hidden = true;
    if (cameras[0].video.ended || (duration > 0 && time >= duration - .05)) seek(0);
    playbackWanted = true;
    const request = ++playbackRequest;
    updateTransport();
    const results = await Promise.allSettled(cameras.map(({ video }) => video.play()));
    if (request !== playbackRequest) return;
    if (results.some((result) => result.status === 'rejected')) {
      pause();
      showError();
      return;
    }
    cancelAnimationFrame(frameRequest);
    tick();
  }

  function refreshCameraLabels() {
    for (const camera of cameras) {
      const label = pick(...camera.name);
      camera.label.textContent = label;
      camera.link.setAttribute('aria-label', pick('Download ' + label + ' MP4', '下载' + label + '视角 MP4'));
      camera.video.setAttribute('aria-label', trialName(currentTrial) + ' · ' + label);
    }
    for (const button of cameraButtons) pressed(button, button.dataset.view === viewMode);
  }

  function releaseCameras() {
    const oldCameras = cameras;
    cameras = [];
    for (const { video } of oldCameras) {
      video.removeAttribute('src');
      video.load();
    }
    grid.replaceChildren();
  }

  function mountCameras({ keepTime = false } = {}) {
    const position = keepTime ? time : 0;
    const resume = keepTime && playbackWanted;
    pause();
    releaseCameras();
    time = position;
    duration = 0;
    error.hidden = true;
    if (!currentTrial) {
      updateTransport();
      return;
    }

    const folder = 'assets/media/' + group().slug + '/' + padded(currentTrial) + '/';
    const selected = viewMode === 'all' ? views : views.filter((view) => view.key === viewMode);
    grid.classList.toggle('is-single', selected.length === 1);
    cameras = selected.map((view) => {
      const figure = document.createElement('figure');
      figure.className = 'camera-figure';
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.width = 640;
      video.height = 480;
      video.poster = folder + view.key + '.webp';
      video.src = folder + view.key + '.mp4';

      const caption = document.createElement('figcaption');
      const label = document.createElement('span');
      const link = document.createElement('a');
      link.href = video.getAttribute('src');
      link.download = group().slug + '-' + padded(currentTrial) + '-' + view.key + '.mp4';
      link.textContent = 'MP4';
      caption.append(label, link);
      figure.append(video, caption);
      grid.append(figure);
      const camera = { ...view, video, label, link };

      video.addEventListener('loadedmetadata', () => {
        if (!cameras.includes(camera)) return;
        if (position > 0) video.currentTime = Math.min(position, video.duration);
        syncDuration();
        updateTransport();
      });
      video.addEventListener('ended', () => {
        if (cameras[0] === camera) {
          time = video.currentTime;
          pause();
        }
      });
      video.addEventListener('error', () => {
        if (cameras.includes(camera)) {
          pause();
          showError();
        }
      });
      return camera;
    });
    refreshCameraLabels();
    syncDuration();
    updateTransport();
    if (resume) void play();
  }

  const skillButtons = groups.map((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'skill-choice';
    const title = document.createElement('strong');
    const score = document.createElement('span');
    score.textContent = (item.count - Object.keys(item.failures).length) + '/' + item.count;
    const number = document.createElement('span');
    number.className = 'skill-number';
    number.textContent = padded(item.task);
    button.append(number, title, score);
    button.addEventListener('click', () => {
      if (index === groupIndex) return;
      groupIndex = index;
      refreshTrials(0);
    });
    skills.append(button);
    return { button, title };
  });

  function refreshText() {
    groups.forEach((item, index) => {
      skillButtons[index].title.textContent = pick(...item.title);
      pressed(skillButtons[index].button, index === groupIndex);
    });
    byId('clip-task').textContent = pick('TASK ' + padded(group().task), '动作 ' + padded(group().task));
    byId('clip-title').textContent = pick(...group().title);
    byId('clip-description').textContent = pick(...group().description);
    for (const button of attempts.children) {
      const number = Number(button.dataset.trial);
      button.setAttribute('aria-label', trialName(number) + ' · ' + outcome(number));
      pressed(button, number === currentTrial);
    }
    for (const filter of filters) pressed(filter, filter.dataset.result === resultFilter);
    refreshCameraLabels();
    if (!error.hidden) showError();

    const index = shownTrials.indexOf(currentTrial);
    const note = byId('attempt-note');
    const failure = currentTrial && failureNote(currentTrial);
    previous.disabled = index <= 0;
    next.disabled = index < 0 || index === shownTrials.length - 1;
    player.hidden = !currentTrial;
    byId('gallery-empty').hidden = Boolean(currentTrial);
    note.hidden = !failure;
    note.textContent = failure ? pick(...failure) : '';
    if (currentTrial) {
      byId('attempt-title').textContent = trialName(currentTrial);
      const flag = byId('attempt-result');
      flag.textContent = outcome(currentTrial);
      flag.classList.toggle('is-failure', Boolean(failure));
    }
    updateTransport();
  }

  function chooseTrial(number) {
    if (currentTrial !== number) {
      currentTrial = number;
      mountCameras();
    }
    refreshText();
  }

  function refreshTrials(preferred) {
    const all = Array.from({ length: group().count }, (_, index) => index + 1);
    shownTrials = all.filter((number) => {
      if (resultFilter === 'all') return true;
      return resultFilter === (failureNote(number) ? 'failure' : 'success');
    });
    attempts.replaceChildren();
    for (const number of shownTrials) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.trial = number;
      button.className = 'attempt-choice';
      button.classList.toggle('is-failure', Boolean(failureNote(number)));
      button.textContent = padded(number);
      button.addEventListener('click', () => chooseTrial(number));
      attempts.append(button);
    }
    currentTrial = shownTrials.includes(preferred) ? preferred : (shownTrials[0] ?? 0);
    mountCameras();
    refreshText();
  }

  for (const filter of filters) {
    filter.addEventListener('click', () => {
      if (filter.dataset.result === resultFilter) return;
      resultFilter = filter.dataset.result;
      refreshTrials(currentTrial);
    });
  }
  for (const button of cameraButtons) {
    button.addEventListener('click', () => {
      if (viewMode === button.dataset.view) return;
      viewMode = button.dataset.view;
      mountCameras({ keepTime: true });
    });
  }
  playButton.addEventListener('click', () => {
    if (playbackWanted) pause();
    else void play();
  });
  playhead.addEventListener('input', () => seek(Number(playhead.value)));
  previous.addEventListener('click', () => chooseTrial(shownTrials[shownTrials.indexOf(currentTrial) - 1]));
  next.addEventListener('click', () => chooseTrial(shownTrials[shownTrials.indexOf(currentTrial) + 1]));
  window.addEventListener('site-language-change', refreshText);
  refreshTrials(currentTrial);
})();
