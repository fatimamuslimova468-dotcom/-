// «Смотрю» — распознавание стран и фирменная анимация флага + герба в комментариях.
// Lightweight DOM/CSS-only module. No canvas, no animation libraries.
(() => {
  'use strict';

  const LETTER_OR_NUMBER = '[^\\p{L}\\p{M}\\p{N}]';
  const MAX_COUNTRIES_PER_COMMENT = 3;
  const MAX_QUEUE_SIZE = 3;
  const PARTICLE_COUNT = 4;
  const ANIMATION_GAP_MS = 90;
  const REDUCED_TOTAL_MS = 620;
  const FULL_TOTAL_MS = 1750;

  const FLAG_CDN = 'https://flagcdn.com/w160';
  const COAT_CDN = 'https://mainfacts.com/media/images/coats_of_arms';
  const ICHKERIA_FLAG = 'ichkeria.svg';
  // Точная локальная ссылка на герб Ичкерии вынесена отдельно, чтобы не подменять его флагом другой страны.
  const ICHKERIA_COAT = 'https://commons.wikimedia.org/wiki/Special:FilePath/Coat_of_arms_of_Chechen_Republic_of_Ichkeria.svg';

  const COUNTRY_DEFS = [
    { id:'russia', name:'Россия', iso:'ru', flag:'🇷🇺', aliases:['россия','россии','россию','россией','россие'] },
    { id:'ukraine', name:'Украина', iso:'ua', flag:'🇺🇦', aliases:['украина','украины','украину','украине','украиной'] },
    { id:'ichkeria', name:'Ичкерия', iso:null, aliases:['ичкерия','ичкерии','ичкерию','ичкерией','ичкерие'], flagImage:ICHKERIA_FLAG, coatImage:ICHKERIA_COAT },
    { id:'germany', name:'Германия', iso:'de', flag:'🇩🇪', aliases:['германия','германии','германию','германией','германие'] },
    { id:'france', name:'Франция', iso:'fr', flag:'🇫🇷', aliases:['франция','франции','францию','францией','францие'] },
    { id:'unitedKingdom', name:'Великобритания', iso:'gb', flag:'🇬🇧', aliases:['великобритания','великобритании','великобританию','великобританией','великобритание','соединенное королевство','соединённое королевство'] },
    { id:'usa', name:'США', iso:'us', flag:'🇺🇸', aliases:['сша','сша́','америка','америки','америку','америке','америкой','соединенные штаты','соединённые штаты'] },
    { id:'china', name:'Китай', iso:'cn', flag:'🇨🇳', aliases:['китай','китая','китае','китаю','китаем'] },
    { id:'japan', name:'Япония', iso:'jp', flag:'🇯🇵', aliases:['япония','японии','японию','японией','японие'] },
    { id:'southKorea', name:'Южная Корея', iso:'kr', flag:'🇰🇷', aliases:['южная корея','южной кореи','южную корею','южной корее','южной кореей','корея','кореи','корею','корее','кореей'] },
    { id:'turkey', name:'Турция', iso:'tr', flag:'🇹🇷', aliases:['турция','турции','турцию','турцией','турцие'] },
    { id:'italy', name:'Италия', iso:'it', flag:'🇮🇹', aliases:['италия','италии','италию','италией','италие'] },
    { id:'spain', name:'Испания', iso:'es', flag:'🇪🇸', aliases:['испания','испании','испанию','испанией','испание'] },
    { id:'portugal', name:'Португалия', iso:'pt', flag:'🇵🇹', aliases:['португалия','португалии','португалию','португалией','португалие'] },
    { id:'brazil', name:'Бразилия', iso:'br', flag:'🇧🇷', aliases:['бразилия','бразилии','бразилию','бразилией','бразилие'] },
    { id:'canada', name:'Канада', iso:'ca', flag:'🇨🇦', aliases:['канада','канады','канаду','канаде','канадой'] },
    { id:'australia', name:'Австралия', iso:'au', flag:'🇦🇺', aliases:['австралия','австралии','австралию','австралией','австралие'] },
    { id:'india', name:'Индия', iso:'in', flag:'🇮🇳', aliases:['индия','индии','индию','индией','инди' ] },
    { id:'kazakhstan', name:'Казахстан', iso:'kz', flag:'🇰🇿', aliases:['казахстан','казахстана','казахстане','казахстану','казахстаном'] },
    { id:'belarus', name:'Беларусь', iso:'by', flag:'🇧🇾', aliases:['беларусь','беларуси','беларусью','беларусе','белоруссия','белоруссии','белоруссию','белоруссией'] },
    { id:'armenia', name:'Армения', iso:'am', flag:'🇦🇲', aliases:['армения','армению','армении','арменией'] },
    { id:'georgia', name:'Грузия', iso:'ge', flag:'🇬🇪', aliases:['грузия','грузии','грузию','грузией','грузие'] },
    { id:'azerbaijan', name:'Азербайджан', iso:'az', flag:'🇦🇿', aliases:['азербайджан','азербайджана','азербайджане','азербайджану','азербайджаном'] },
    { id:'uzbekistan', name:'Узбекистан', iso:'uz', flag:'🇺🇿', aliases:['узбекистан','узбекистана','узбекистане','узбекистану','узбекистаном'] },
    { id:'kyrgyzstan', name:'Кыргызстан', iso:'kg', flag:'🇰🇬', aliases:['кыргызстан','кыргызстана','кыргызстане','кыргызстану','кыргызстаном','киргизия','киргизии','киргизию','киргизией','киргизие'] },
    { id:'tajikistan', name:'Таджикистан', iso:'tj', flag:'🇹🇯', aliases:['таджикистан','таджикистана','таджикистане','таджикистану','таджикистаном'] },
    { id:'turkmenistan', name:'Туркменистан', iso:'tm', flag:'🇹🇲', aliases:['туркменистан','туркменистана','туркменистане','туркменистану','туркменистаном'] },
    { id:'israel', name:'Израиль', iso:'il', flag:'🇮🇱', aliases:['израиль','израиля','израиле','израилю','израилем'] },
    { id:'egypt', name:'Египет', iso:'eg', flag:'🇪🇬', aliases:['египет','египта','египте','египту','египтом'] },
    { id:'uae', name:'ОАЭ', iso:'ae', flag:'🇦🇪', aliases:['оаэ','объединенные арабские эмираты','объединённые арабские эмираты','объединённых арабских эмиратов','объединенных арабских эмиратов'] }
  ];

  function normalize(value) {
    return String(value || '')
      .normalize('NFC')
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е');
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function aliasPattern(alias) {
    const words = normalize(alias).trim().split(/\s+/).filter(Boolean);
    return words.map(escapeRegex).join('[\\s\\-]+');
  }

  const aliasEntries = COUNTRY_DEFS
    .flatMap(country => country.aliases.map(alias => ({ country, alias, pattern: aliasPattern(alias) })))
    .filter(entry => entry.pattern)
    .sort((a,b) => b.pattern.length - a.pattern.length);

  function makeBoundaryRegex(pattern) {
    return new RegExp(`(^|${LETTER_OR_NUMBER})(${pattern})(?=$|${LETTER_OR_NUMBER})`, 'giu');
  }

  function detectCountries(text, options = {}) {
    const source = String(text || '');
    if (!source) return [];
    const max = Math.max(1, Math.min(Number(options.max) || MAX_COUNTRIES_PER_COMMENT, MAX_COUNTRIES_PER_COMMENT));
    const normalizedSource = normalize(source);
    const candidates = [];

    for (const entry of aliasEntries) {
      const regex = makeBoundaryRegex(entry.pattern);
      let match;
      while ((match = regex.exec(normalizedSource))) {
        const prefix = match[1] || '';
        const matched = match[2] || '';
        const start = match.index + prefix.length;
        const end = start + matched.length;
        candidates.push({ country: entry.country, alias: entry.alias, start, end, length: end - start });
      }
    }

    candidates.sort((a,b) => a.start - b.start || b.length - a.length);
    const accepted = [];
    const seen = new Set();
    for (const candidate of candidates) {
      if (seen.has(candidate.country.id)) continue;
      if (accepted.some(item => candidate.start < item.end && candidate.end > item.start)) continue;
      seen.add(candidate.country.id);
      accepted.push(candidate);
      if (accepted.length >= max) break;
    }

    return accepted.map(match => ({
      id: match.country.id,
      name: match.country.name,
      iso: match.country.iso || '',
      flag: match.country.flag || '',
      flagImage: match.country.flagImage || (match.country.iso ? `${FLAG_CDN}/${match.country.iso}.png` : ''),
      coatImage: match.country.coatImage || (match.country.iso ? `${COAT_CDN}/${match.country.iso}.svg` : ''),
      alias: match.alias,
      start: match.start,
      end: match.end
    }));
  }

  function prefersReducedMotion() {
    return Boolean(
      document.body?.classList.contains('low-performance') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    );
  }

  function getLayer() {
    let layer = document.getElementById('countryFlagAnimationLayer');
    if (layer) return layer;
    const sheet = document.querySelector('#commentsModal .modal-sheet');
    if (!sheet) return null;
    layer = document.createElement('div');
    layer.id = 'countryFlagAnimationLayer';
    layer.className = 'country-flag-animation-layer';
    layer.setAttribute('aria-hidden', 'true');
    sheet.appendChild(layer);
    return layer;
  }

  function makeParticle(index) {
    const el = document.createElement('span');
    el.className = `country-flag-particle country-flag-particle-${index + 1}`;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  function addImageWithFallback(parent, {src, fallbackText, className, alt = ''}) {
    if (!src) return null;
    const img = document.createElement('img');
    img.className = className;
    img.src = src;
    img.alt = alt;
    img.decoding = 'async';
    img.loading = 'eager';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      const fallback = document.createElement('span');
      fallback.className = `${className} country-media-fallback`;
      fallback.textContent = fallbackText || '';
      fallback.setAttribute('aria-hidden', 'true');
      img.replaceWith(fallback);
    };
    parent.appendChild(img);
    return img;
  }

  function createCard(country, reduced) {
    const card = document.createElement('div');
    card.className = `country-flag-card${reduced ? ' reduced-motion' : ''}`;
    card.setAttribute('role', 'status');
    card.setAttribute('aria-label', `${country.name}, флаг и герб`);

    const glow = document.createElement('div');
    glow.className = 'country-flag-glow';
    glow.setAttribute('aria-hidden', 'true');

    const media = document.createElement('div');
    media.className = 'country-flag-media';

    const flagWrap = document.createElement('div');
    flagWrap.className = 'country-flag-visual';
    if (country.flagImage) {
      addImageWithFallback(flagWrap, {src:country.flagImage, fallbackText:country.flag, className:'country-flag-image'});
    } else {
      const emoji = document.createElement('span');
      emoji.className = 'country-flag-emoji';
      emoji.textContent = country.flag || '🌐';
      emoji.setAttribute('aria-hidden', 'true');
      flagWrap.appendChild(emoji);
    }

    const coatWrap = document.createElement('div');
    coatWrap.className = 'country-coat-visual';
    coatWrap.setAttribute('aria-hidden', 'true');
    addImageWithFallback(coatWrap, {src:country.coatImage, fallbackText:'✦', className:'country-coat-image'});

    media.append(flagWrap, coatWrap);

    const title = document.createElement('div');
    title.className = 'country-flag-title';
    title.textContent = country.name;

    card.append(glow, media, title);
    if (!reduced) for (let i = 0; i < PARTICLE_COUNT; i += 1) card.appendChild(makeParticle(i));
    return card;
  }

  const state = { queue: [], running: false, lastStart: 0, timer: null };

  function scheduleNext() {
    if (state.running || !state.queue.length) return;
    const wait = Math.max(0, ANIMATION_GAP_MS - (Date.now() - state.lastStart));
    if (wait > 0) {
      window.clearTimeout(state.timer);
      state.timer = window.setTimeout(() => { state.timer = null; scheduleNext(); }, wait);
      return;
    }
    const item = state.queue.shift();
    state.running = true;
    state.lastStart = Date.now();
    playCard(item);
  }

  function playCard(country) {
    const layer = getLayer();
    if (!layer || !document.getElementById('commentsModal')?.classList.contains('visible')) {
      state.running = false;
      scheduleNext();
      return;
    }

    const reduced = prefersReducedMotion();
    const card = createCard(country, reduced);
    layer.appendChild(card);

    const total = reduced ? REDUCED_TOTAL_MS : FULL_TOTAL_MS;
    let ended = false;
    let cleanupTimer = 0;

    const cleanup = () => {
      if (ended) return;
      ended = true;
      window.clearTimeout(cleanupTimer);
      card.removeEventListener('animationend', onAnimationEnd);
      card.remove();
      state.running = false;
      scheduleNext();
    };

    const onAnimationEnd = event => {
      if (event.target === card && event.animationName === 'countryFlagCardOut') cleanup();
    };

    card.addEventListener('animationend', onAnimationEnd, {passive:true});
    cleanupTimer = window.setTimeout(cleanup, total + 350);
  }

  function enqueueCountries(countries) {
    const unique = [];
    const seen = new Set();
    for (const country of countries || []) {
      if (!country || seen.has(country.id)) continue;
      seen.add(country.id);
      unique.push(country);
      if (unique.length >= MAX_COUNTRIES_PER_COMMENT) break;
    }
    if (!unique.length) return [];

    const freeSlots = Math.max(0, MAX_QUEUE_SIZE - state.queue.length - (state.running ? 1 : 0));
    if (freeSlots <= 0) return [];
    state.queue.push(...unique.slice(0, freeSlots));
    scheduleNext();
    return unique.slice(0, freeSlots);
  }

  function preloadCountries(countries) {
    const list = Array.isArray(countries) ? countries.slice(0, MAX_COUNTRIES_PER_COMMENT) : [];
    for (const country of list) {
      for (const src of [country.flagImage, country.coatImage]) {
        if (!src) continue;
        const img = new Image();
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.src = src;
      }
    }
  }

  function enqueueFromComment(text, knownMatches) {
    const matches = Array.isArray(knownMatches)
      ? knownMatches.slice(0, MAX_COUNTRIES_PER_COMMENT)
      : detectCountries(text, {max:MAX_COUNTRIES_PER_COMMENT});
    preloadCountries(matches);
    return enqueueCountries(matches);
  }

  function flashCommentCountryWords(text, userId, knownMatches) {
    const source = String(text || '').trim();
    const matches = Array.isArray(knownMatches) ? knownMatches.slice(0, MAX_COUNTRIES_PER_COMMENT) : detectCountries(source);
    if (!source || !matches.length) return;

    const commentItems = document.querySelectorAll('#commentsList .comment-item[data-comment-type="text"]');
    let target = null;
    for (const item of commentItems) {
      if (userId && String(item.dataset.userId || '') !== String(userId)) continue;
      const textNode = item.querySelector('.comment-textual');
      if (textNode && textNode.textContent.trim() === source) { target = textNode; break; }
    }
    if (!target) return;

    const raw = target.textContent || '';
    const frag = document.createDocumentFragment();
    let cursor = 0;
    matches.forEach(match => {
      const safeStart = Math.max(0, Math.min(raw.length, match.start));
      const safeEnd = Math.max(safeStart, Math.min(raw.length, match.end));
      if (safeStart < cursor) return;
      if (safeStart > cursor) frag.appendChild(document.createTextNode(raw.slice(cursor, safeStart)));
      const span = document.createElement('span');
      span.className = 'country-name-flash';
      span.textContent = raw.slice(safeStart, safeEnd);
      frag.appendChild(span);
      cursor = safeEnd;
    });
    if (cursor < raw.length) frag.appendChild(document.createTextNode(raw.slice(cursor)));
    target.replaceChildren(frag);

    window.setTimeout(() => {
      target.querySelectorAll('.country-name-flash').forEach(el => el.replaceWith(document.createTextNode(el.textContent || '')));
    }, prefersReducedMotion() ? 300 : 650);
  }

  window.SmotruCountryFlags = {
    detectCountries,
    enqueueFromComment,
    showCountryFlagAnimation: country => enqueueCountries(country ? [country] : []),
    flashCommentCountryWords,
    preloadCountries,
    constants: { maxCountriesPerComment:MAX_COUNTRIES_PER_COMMENT, maxQueueSize:MAX_QUEUE_SIZE, fullAnimationMs:FULL_TOTAL_MS, reducedAnimationMs:REDUCED_TOTAL_MS }
  };
})();
