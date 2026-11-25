export function createUI() {
  const boot = document.getElementById('boot');
  const menu = document.getElementById('menu');
  const dialogue = document.getElementById('dialogue');
  const verdict = document.getElementById('verdict');
  const shop = document.getElementById('shop');
  const result = document.getElementById('result');
  const toasts = document.getElementById('toasts');
  const questions = document.getElementById('questions');
  const transcript = document.getElementById('transcript');
  const shopCards = document.getElementById('shop-cards');
  const flash = document.getElementById('flash');

  const api = {
    onBegin: null,
    onBuy: null,
    onQuestion: null,
    onVerdict: null,
    onCloseDialogue: null,
    onCloseShop: null,
    onReset: null,
    onToggleMute: null,
  };

  let resultTimer = 0;

  document.getElementById('begin').addEventListener('click', () => {
    document.getElementById('begin').blur();
    api.onBegin?.();
  });
  document.getElementById('dialogue-close').addEventListener('click', () => api.onCloseDialogue?.());
  document.getElementById('shop-close').addEventListener('click', () => api.onCloseShop?.());
  document.getElementById('shop-reset').addEventListener('click', () => api.onReset?.());
  document.getElementById('verdict-heaven').addEventListener('click', () => api.onVerdict?.('HEAVEN'));
  document.getElementById('verdict-hell').addEventListener('click', () => api.onVerdict?.('HELL'));
  document.getElementById('mute').addEventListener('click', () => api.onToggleMute?.());

  const crosshair = document.createElement('div');
  crosshair.id = 'crosshair';
  crosshair.innerHTML = '<span></span><span></span><span></span><span></span>';
  document.getElementById('app').appendChild(crosshair);

  function ready() {
    boot.classList.add('hidden');
  }

  function fail(message) {
    boot.classList.remove('hidden');
    boot.textContent = message;
  }

  function hideMenu() {
    menu.classList.add('hidden');
    document.body.classList.add('playing');
  }

  function sync(state) {
    document.getElementById('coins').textContent = String(state.coins);
    document.getElementById('streak').textContent = String(state.streak);
    document.getElementById('best').textContent = String(state.best);
    document.getElementById('filed').textContent = String(state.filed);
    document.getElementById('mult').textContent = `×${state.multiplier}`;
    document.body.classList.toggle('has-rite', state.multiplier > 1);
    document.getElementById('objective-kicker').textContent = state.kicker;
    document.getElementById('objective').textContent = state.objective;
    document.getElementById('prompt').textContent = state.prompt;
    document.getElementById('compass-label').textContent = state.compassLabel;
    document.getElementById('compass-arrow').style.transform = `rotate(${state.compassAngle}rad)`;
    const lens = document.getElementById('lens-readout');
    if (!state.lensOwned) {
      lens.classList.add('hidden');
    } else {
      lens.classList.remove('hidden');
      lens.classList.toggle('hot', state.lensHot);
      lens.textContent = state.lensText;
    }
    const look = document.getElementById('look-hint');
    look.classList.toggle('hidden', !state.showLookHint);
    look.textContent = state.lookHint;
    setVerdictVisible(state.showVerdict);
  }

  function setVerdictVisible(show) {
    verdict.classList.toggle('hidden', !show);
  }

  function openDialogue(soul) {
    document.getElementById('case-id').textContent = soul.caseLabel;
    questions.replaceChildren();
    transcript.replaceChildren();
    soul.questions.forEach((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = entry.q;
      button.disabled = soul.asked[index];
      button.addEventListener('click', () => api.onQuestion?.(index));
      questions.appendChild(button);
    });
    soul.questions.forEach((entry, index) => {
      if (soul.asked[index]) appendAnswer(entry);
    });
    dialogue.classList.remove('hidden');
  }

  function markAsked(index, entry) {
    const button = questions.children[index];
    if (button) button.disabled = true;
    appendAnswer(entry);
  }

  function appendAnswer(entry) {
    const block = document.createElement('div');
    block.className = 'qa';
    const q = document.createElement('p');
    q.className = 'q';
    q.textContent = entry.q;
    const a = document.createElement('p');
    a.className = 'a';
    a.textContent = `“${entry.a}”`;
    block.append(q, a);
    transcript.appendChild(block);
    transcript.scrollTop = transcript.scrollHeight;
  }

  function closeDialogue() {
    dialogue.classList.add('hidden');
  }

  function dialogueOpen() {
    return !dialogue.classList.contains('hidden');
  }

  function renderShop(model) {
    shopCards.replaceChildren();
    model.upgrades.forEach((upgrade) => {
      const card = document.createElement('article');
      card.className = 'card';
      const title = document.createElement('h3');
      title.textContent = upgrade.name;
      const copy = document.createElement('p');
      copy.textContent = `${upgrade.blurb} ${upgrade.detail}`;
      const pips = document.createElement('div');
      pips.className = 'pips';
      for (let i = 0; i < upgrade.max; i += 1) {
        const pip = document.createElement('i');
        if (i < upgrade.level) pip.classList.add('on');
        pips.appendChild(pip);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'buy';
      button.disabled = upgrade.maxed || !upgrade.affordable;
      button.textContent = upgrade.maxed ? 'Inscribed' : `Buy · ${upgrade.cost}`;
      button.addEventListener('click', () => api.onBuy?.(upgrade.id));
      card.append(title, copy, pips, button);
      shopCards.appendChild(card);
    });
    document.getElementById('shop-coins').textContent = `${model.coins} Soul Coins`;
    shop.classList.remove('hidden');
  }

  function closeShop() {
    shop.classList.add('hidden');
  }

  function shopOpen() {
    return !shop.classList.contains('hidden');
  }

  function showResult(payload) {
    result.classList.remove('hidden', 'good', 'bad');
    result.classList.add(payload.correct ? 'good' : 'bad');
    document.body.classList.add('has-result');
    document.getElementById('result-kicker').textContent = payload.kicker;
    document.getElementById('result-title').textContent = payload.title;
    document.getElementById('result-detail').textContent = payload.detail;
    document.getElementById('result-coins').textContent = payload.coins;
    window.clearTimeout(resultTimer);
    resultTimer = window.setTimeout(() => {
      result.classList.add('hidden');
      document.body.classList.remove('has-result');
    }, 4600);
  }

  function toast(text, kind = 'info') {
    const node = document.createElement('div');
    node.className = `toast ${kind}`;
    node.textContent = text;
    toasts.appendChild(node);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    window.setTimeout(() => {
      node.classList.add('out');
      window.setTimeout(() => node.remove(), 400);
    }, 3200);
  }

  function flashScreen(kind) {
    flash.classList.remove('heaven', 'hell', 'bad');
    void flash.offsetWidth;
    flash.classList.add(kind);
  }

  function setMuted(muted) {
    const button = document.getElementById('mute');
    button.textContent = muted ? 'Sound off' : 'Sound on';
    button.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }

  function blocksLook() {
    return dialogueOpen() || shopOpen() || !menu.classList.contains('hidden');
  }

  return {
    api,
    ready,
    fail,
    hideMenu,
    sync,
    openDialogue,
    markAsked,
    closeDialogue,
    dialogueOpen,
    renderShop,
    closeShop,
    shopOpen,
    showResult,
    toast,
    flashScreen,
    setMuted,
    blocksLook,
  };
}
