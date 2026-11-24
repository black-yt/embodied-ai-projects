(() => {
  const key = 'embodied-project-language';
  const attributes = ['aria-label', 'alt', 'content', 'href'];
  const translations = [...document.querySelectorAll('[data-zh], [data-zh-aria-label], [data-zh-alt], [data-zh-content], [data-zh-href]')]
    .map((node) => ({
      node,
      text: node.hasAttribute('data-zh') ? [node.textContent, node.getAttribute('data-zh')] : null,
      attributes: attributes.filter((name) => node.hasAttribute('data-zh-' + name))
        .map((name) => [name, node.getAttribute(name), node.getAttribute('data-zh-' + name)])
    }));
  const buttons = [...document.querySelectorAll('[data-language]')];

  function storedLanguage() {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function setLanguage(next, remember = true) {
    const language = next === 'zh-CN' ? 'zh-CN' : 'en';
    const chinese = language === 'zh-CN';
    document.documentElement.lang = language;
    for (const entry of translations) {
      if (entry.text) entry.node.textContent = entry.text[chinese ? 1 : 0];
      for (const [name, english, translated] of entry.attributes) {
        entry.node.setAttribute(name, chinese ? translated : english);
      }
    }
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    }
    if (remember) {
      try {
        localStorage.setItem(key, language);
      } catch {
        // Keep the selected language in this page when storage is unavailable.
      }
    }
    window.dispatchEvent(new CustomEvent('site-language-change'));
  }

  window.siteLocale = {
    pick: (english, chinese) => document.documentElement.lang === 'zh-CN' ? chinese : english
  };
  for (const button of buttons) {
    button.addEventListener('click', () => setLanguage(button.dataset.language));
  }
  setLanguage(storedLanguage(), false);
})();
