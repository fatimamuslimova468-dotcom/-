// ========== APP DATA LAYER ==========
    // Direct Supabase connection.
    const SUPABASE_DIRECT_URL = "https://xzaryhtrzdjrrqgrowkv.supabase.co";
    const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EwldCPF1drff-q6Ei5zYcQ__is80B0T";
    const CONFIGURED_SUPABASE_URL = window.SMOTRY_CONFIG?.SUPABASE_URL || '';
    const SUPABASE_URL = normalizeSupabaseBaseUrl(CONFIGURED_SUPABASE_URL || SUPABASE_DIRECT_URL);
    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      global: {
        headers: { 'X-Client-Info': 'smotry-web' }
      }
    });

    function normalizeSupabaseBaseUrl(value) {
      const raw = String(value || '').trim();
      return (raw || SUPABASE_DIRECT_URL).replace(/\/+$/, '');
    }

    function rewriteSupabaseUrl(value) {
      const raw = String(value || '').trim();
      if (!raw) return '';
      try {
        const u = new URL(raw, SUPABASE_URL);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
        return u.href;
      } catch (_) {
        return '';
      }
    }
    const STORAGE_BUCKET = "smotry-videos";
    const STICKER_BUCKET = "smotry-videos";
    const MUSIC_2021_CATALOG = [
      {"title": "Положение", "artist": "Skryptonite", "year": 2021},
      {"title": "Москва любит...", "artist": "Скриптонит", "year": 2021},
      {"title": "Цепи (feat. 104)", "artist": "Скриптонит", "year": 2021},
      {"title": "Сияй", "artist": "Ramil'", "year": 2021},
      {"title": "Чистый (OST «Псих»)", "artist": "Скриптонит", "year": 2021},
      {"title": "Это любовь", "artist": "Скриптонит", "year": 2021},
      {"title": "неболей", "artist": "Баста & Zivert", "year": 2021},
      {"title": "Горький вкус", "artist": "Султан Лагучев", "year": 2021},
      {"title": "Патрон", "artist": "Miyagi & Andy Panda", "year": 2021},
      {"title": "Ураган (feat. V $ X V PRiNCE)", "artist": "Гуф & Murovei", "year": 2021},
      {"title": "Венера-Юпитер", "artist": "Ваня Дмитриенко", "year": 2021},
      {"title": "I Got Love (feat. Рем Дигга)", "artist": "Miyagi & Эндшпиль", "year": 2021},
      {"title": "Нету интереса", "artist": "10AGE", "year": 2021},
      {"title": "Салют, Вера", "artist": "Mona Songz", "year": 2021},
      {"title": "Птичка", "artist": "HammAli & Navai", "year": 2021},
      {"title": "Я в моменте", "artist": "Джарахов & Markul", "year": 2021},
      {"title": "Лилии", "artist": "МОТ & JONY", "year": 2021},
      {"title": "Сон", "artist": "Ramil'", "year": 2021},
      {"title": "Ты была права", "artist": "Баста", "year": 2021},
      {"title": "Пополам", "artist": "BRANYA & MACAN", "year": 2021},
      {"title": "Пушка", "artist": "10AGE", "year": 2021},
      {"title": "Cristal & МОЁТ", "artist": "MORGENSHTERN", "year": 2021},
      {"title": "Комета", "artist": "JONY", "year": 2021},
      {"title": "Федерико Феллини", "artist": "Galibri & Mavik", "year": 2021},
      {"title": "А если это любовь?", "artist": "HammAli & Navai", "year": 2021},
      {"title": "Не Бруклин", "artist": "МОТ & LYRIQ", "year": 2021},
      {"title": "Юность", "artist": "Dabro", "year": 2021},
      {"title": "Мир сошёл с ума", "artist": "JONY", "year": 2021},
      {"title": "Балкон", "artist": "ELMAN & JONY", "year": 2021},
      {"title": "По уши я в тебя влюблён", "artist": "Miyagi", "year": 2021},
      {"title": "Снова я напиваюсь", "artist": "SLAVA MARLOW", "year": 2021},
      {"title": "Ягода малинка", "artist": "Хабиб", "year": 2021},
      {"title": "Голодный пёс (feat. SODA LUV)", "artist": "SEEMEE", "year": 2021},
      {"title": "Многоточия", "artist": "Zivert", "year": 2021},
      {"title": "БЕГИ (feat. Poët)", "artist": "DJ SMASH", "year": 2021},
      {"title": "У окна", "artist": "HammAli & Navai", "year": 2021},
      {"title": "Стеклянная", "artist": "GUMA", "year": 2021},
      {"title": "ТЫ ГОРИШЬ КАК ОГОНЬ", "artist": "SLAVA MARLOW", "year": 2021},
      {"title": "Голос", "artist": "Егор Крид", "year": 2021},
      {"title": "Быстро", "artist": "SLAVA MARLOW & MORGENSHTERN", "year": 2021},
      {"title": "Истеричка", "artist": "Artik & Asti", "year": 2021},
      {"title": "Если тебе будет грустно", "artist": "Rauf & Faik & NILETTO", "year": 2021},
      {"title": "Искал-нашёл", "artist": "Jah Khalib", "year": 2021},
      {"title": "Пошла жара", "artist": "GAYAZOV$ BROTHER$ & Filatov & Karas", "year": 2021},
      {"title": "Август - это ты", "artist": "МОТ", "year": 2021},
      {"title": "Я так соскучился", "artist": "Порнофильмы", "year": 2021},
      {"title": "Любовь после тебя", "artist": "Artik & Asti", "year": 2021},
      {"title": "Не жалея", "artist": "Miyagi & Andy Panda", "year": 2021},
      {"title": "Зоопарк", "artist": "10AGE", "year": 2021},
      {"title": "Братик", "artist": "Bittuev", "year": 2021},
      {"title": "Останься", "artist": "NЮ & Асия", "year": 2021},
      {"title": "По щекам слёзы", "artist": "КУЧЕР & JANAGA", "year": 2021},
      {"title": "Cristal & МОЁТ (Remix)", "artist": "MORGENSHTERN, SODA LUV, blago white, OG Buda & MAYOT", "year": 2021},
      {"title": "НЕ ЖАЛЬ (feat. Miyagi & Скриптонит)", "artist": "104", "year": 2021},
      {"title": "Босс", "artist": "JONY & The Limba", "year": 2021},
      {"title": "Краш", "artist": "Клава Кока & NILETTO", "year": 2021},
      {"title": "Поболело и прошло", "artist": "HENSY", "year": 2021},
      {"title": "Из-за тебя", "artist": "Ramil' & Елена Темникова", "year": 2021},
      {"title": "Тлеет (feat. SVNV)", "artist": "BULA", "year": 2021},
      {"title": "Медляк", "artist": "HammAli & Мари Краймбрери", "year": 2021},
      {"title": "Последний поцелуй", "artist": "Artik & Asti", "year": 2021},
      {"title": "Последний поцелуй", "artist": "Руки Вверх & HammAli & Navai", "year": 2021},
      {"title": "Вороны", "artist": "Xcho", "year": 2021},
      {"title": "Косички", "artist": "Mary Gu", "year": 2021},
      {"title": "Не люблю?", "artist": "Анет Сай & NILETTO", "year": 2021},
      {"title": "Я поднимаюсь над землёй (feat. Алёна Омаргалиева)", "artist": "Баста", "year": 2021},
      {"title": "Мальчик на девятке", "artist": "DEAD BLONDE", "year": 2021},
      {"title": "Красное Вино", "artist": "NK", "year": 2021},
      {"title": "Дом Периньон", "artist": "Пошлая Молли & Элджей", "year": 2021},
      {"title": "Из-за тебя", "artist": "Akmal'", "year": 2021},
      {"title": "Без названия", "artist": "MACAN", "year": 2021},
      {"title": "Окей", "artist": "Тима Белорусских", "year": 2021},
      {"title": "Жить как я живу", "artist": "Scriptonite", "year": 2021},
      {"title": "Я весь мир обошёл", "artist": "HammAli & Navai", "year": 2021},
      {"title": "Копия пиратская", "artist": "Mekhman", "year": 2021},
      {"title": "Рокки", "artist": "Zivert", "year": 2021},
      {"title": "Лиловая", "artist": "Jah Khalib", "year": 2021},
      {"title": "Никаких эмоций", "artist": "The Limba, Andro & Navai", "year": 2021},
      {"title": "На чиле", "artist": "GeeGun", "year": 2021},
      {"title": "Ты не моя пара", "artist": "Дима Билан & Мари Краймбрери", "year": 2021},
      {"title": "ДУРАКАМ ВЕЗЁТ", "artist": "ФОГЕЛЬ", "year": 2021},
      {"title": "Цифры (feat. Rodionis)", "artist": "Scriptonite, Индаблэк & qurt", "year": 2021},
      {"title": "Я в моменте 2", "artist": "Джарахов & Mary Gu", "year": 2021},
      {"title": "Не влюбляйся", "artist": "Mary Gu", "year": 2021},
      {"title": "Ратата", "artist": "Konfuz", "year": 2021},
      {"title": "Бигасс", "artist": "SODA LUV & WHY, BERRY", "year": 2021},
      {"title": "ДУЛО", "artist": "MORGENSHTERN", "year": 2021},
      {"title": "люби меня так", "artist": "By Индия", "year": 2021},
      {"title": "Эйя", "artist": "Канги", "year": 2021},
      {"title": "Падаю - Поймай", "artist": "JONY", "year": 2021},
      {"title": "Синий Lamborghini", "artist": "Rakhim", "year": 2021},
      {"title": "Стерва", "artist": "Ваня Дмитриенко", "year": 2021},
      {"title": "Новая волна", "artist": "DJ SMASH & MORGENSHTERN", "year": 2021},
      {"title": "Три Дня Любви", "artist": "Zivert", "year": 2021},
      {"title": "Талия (feat. Truwer)", "artist": "Niman", "year": 2021},
      {"title": "Крузак 200", "artist": "BODIEV", "year": 2021},
      {"title": "Minor", "artist": "Miyagi & Andy Panda", "year": 2021},
      {"title": "Там ревели горы", "artist": "Miyagi & Andy Panda", "year": 2021},
      {"title": "Cadillac", "artist": "MORGENSHTERN & Элджей", "year": 2021},
      {"title": "Rolls Royce", "artist": "Джиган, Тимати & Егор Крид", "year": 2021},
      {"title": "По глазам", "artist": "SLAVA MARLOW", "year": 2021},
      {"title": "Ты пари", "artist": "JONY", "year": 2021},
      {"title": "moLOko", "artist": "LOBODA", "year": 2021},
      {"title": "Девочка танцуй", "artist": "ARTIK & ASTI", "year": 2021},
      {"title": "ПРИВЫЧКА", "artist": "ФОГЕЛЬ", "year": 2021},
      {"title": "Кайф ты поймала", "artist": "Konfuz", "year": 2021},
      {"title": "Она любила розы", "artist": "Ислам Итляшев", "year": 2021},
      {"title": "невывоЗИМАя", "artist": "NILETTO", "year": 2021},
      {"title": "Моё искусство", "artist": "AMAN ZHU", "year": 2021},
      {"title": "Дожили", "artist": "WEGAS & ARCHI", "year": 2021},
      {"title": "17", "artist": "Mary Gu", "year": 2021},
      {"title": "Насквозь", "artist": "TumaniYO & Sимптом", "year": 2021},
      {"title": "Не реви", "artist": "X.O", "year": 2021},
      {"title": "WATAFUK?!", "artist": "MORGENSHTERN & Lil Pump", "year": 2021},
      {"title": "El Problema", "artist": "MORGENSHTERN, Roni Schwartz & SHINGA", "year": 2021},
      {"title": "Отпускаю", "artist": "ELMAN & Gafur", "year": 2021},
      {"title": "Холодно", "artist": "NLO", "year": 2021},
      {"title": "ЖОПА ДЖУСИ", "artist": "INSTASAMKA & MONEYKEN", "year": 2021},
      {"title": "Балдини", "artist": "Шейх Мансур", "year": 2021},
      {"title": "Пьяную домой", "artist": "Klava Koka", "year": 2021},
      {"title": "Муза", "artist": "ELMAN & JONY", "year": 2021},
      {"title": "Camry 3.5", "artist": "UncleFlexxx", "year": 2021},
      {"title": "Дико Тусим", "artist": "Даня Милохин & Николай Басков", "year": 2021},
      {"title": "Любимка", "artist": "NILETTO", "year": 2021},
      {"title": "Плачу на техно", "artist": "Cream Soda & Хлеб", "year": 2021},
      {"title": "Молодость", "artist": "Баста", "year": 2021},
      {"title": "Рамок нет (feat. Feduk)", "artist": "Скриптонит", "year": 2021},
      {"title": "Любите, девушки (LAB с Антоном Беляевым)", "artist": "Gruppa Skryptonite & Therr Maitz", "year": 2021},
      {"title": "Lollipop", "artist": "Gafur & JONY", "year": 2021},
      {"title": "Мультибрендовый (feat. 104 & T-Fest)", "artist": "Скриптонит", "year": 2021},
      {"title": "Франция", "artist": "Jamik & PUSSYKILLER", "year": 2021},
      {"title": "Кеттiк", "artist": "Ирина Кайратовна", "year": 2021},
      {"title": "5000", "artist": "Ирина Кайратовна", "year": 2021},
      {"title": "Молодость (feat. Скриптонит)", "artist": "Баста", "year": 2021},
      {"title": "Это была любовь", "artist": "Дима Билан & Zivert", "year": 2021},
      {"title": "Лампочка", "artist": "NILETTO", "year": 2021},
      {"title": "Пьяная", "artist": "Zivert", "year": 2021},
      {"title": "Мимо", "artist": "JONY", "year": 2021},
      {"title": "Ты бы не позвонила", "artist": "MOT & LYRIQ", "year": 2021},
      {"title": "Скажи мне", "artist": "HammAli & Navai", "year": 2021},
      {"title": "Прятки", "artist": "HammAli & Navai", "year": 2021},
      {"title": "Не пиши", "artist": "JONY", "year": 2021},
      {"title": "Теряем мы любовь", "artist": "Rauf & Faik", "year": 2021},
      {"title": "Не смогу забыть", "artist": "Ramil'", "year": 2021},
      {"title": "Всё ещё люблю", "artist": "MAYOT", "year": 2021},
      {"title": "Потерял себя", "artist": "OG Buda & Тима Белорусских", "year": 2021},
      {"title": "Неправильно", "artist": "OG Buda & LOVV66", "year": 2021},
      {"title": "Добро пожаловать", "artist": "OG Buda & MAYOT", "year": 2021},
      {"title": "Стейк", "artist": "OG Buda, Yanix & 163ONMYNECK", "year": 2021},
      {"title": "Не приходи", "artist": "OG Buda", "year": 2021},
      {"title": "Фэм", "artist": "OG Buda & blago white", "year": 2021},
      {"title": "Вина", "artist": "OG Buda & MAYOT & 17 Seventeen", "year": 2021},
      {"title": "Ногти", "artist": "Lovesomemama", "year": 2021},
      {"title": "Виктория Сикрет", "artist": "163ONMYNECK", "year": 2021},
      {"title": "G-Shokk", "artist": "Soda Luv", "year": 2021},
      {"title": "Kelin", "artist": "Saluki & 104", "year": 2021},
      {"title": "Битбокс", "artist": "SEEMEE", "year": 2021},
      {"title": "Pussy Boy", "artist": "Егор Крид", "year": 2021},
      {"title": "Abu Dhabi Ba6y", "artist": "Платина", "year": 2021},
      {"title": "Тайна", "artist": "Fendiglock", "year": 2021},
      {"title": "Цветок", "artist": "SEEMEE", "year": 2021},
      {"title": "Разгон", "artist": "Pinq", "year": 2021},
      {"title": "Микро", "artist": "LowLife", "year": 2021},
      {"title": "Где плохой поц?", "artist": "Plohoyparen", "year": 2021},
      {"title": "Джинсы", "artist": "MAYOT", "year": 2021},
      {"title": "Торчи", "artist": "MAYOT", "year": 2021},
      {"title": "Karuptsi", "artist": "Blago White", "year": 2021},
      {"title": "Пинк Флойд", "artist": "OG Buda & 163ONMYNECK", "year": 2021},
      {"title": "Сладких снов", "artist": "Soda Luv", "year": 2021},
      {"title": "Котик", "artist": "Soda Luv", "year": 2021},
      {"title": "Скам", "artist": "Lil Krystalll", "year": 2021},
      {"title": "Моё сердце", "artist": "Jah Khalib", "year": 2021},
      {"title": "Доча", "artist": "MOT", "year": 2021},
      {"title": "По кайфу", "artist": "The Limba", "year": 2021},
      {"title": "Танцуй со мной", "artist": "JONY", "year": 2021},
      {"title": "Там где ты", "artist": "Ramil'", "year": 2021},
      {"title": "Сонная", "artist": "Rauf & Faik", "year": 2021},
      {"title": "Медуза", "artist": "MORGENSHTERN", "year": 2021},
      {"title": "Ice", "artist": "MORGENSHTERN", "year": 2021},
      {"title": "Половина", "artist": "Мари Краймбрери", "year": 2021},
      {"title": "Случайности не случайны", "artist": "Мари Краймбрери", "year": 2021},
      {"title": "Океан", "artist": "Мари Краймбрери", "year": 2021},
      {"title": "Грустный дэнс", "artist": "Артём Качер & ARTIK & ASTI", "year": 2021},
      {"title": "Артур Пирожков", "artist": "Артур Пирожков", "year": 2021},
      {"title": "За деньги да", "artist": "INSTASAMKA", "year": 2021},
      {"title": "ЛУНА", "artist": "NILETTO", "year": 2021},
      {"title": "Девочка-провинция", "artist": "NILETTO", "year": 2021},
      {"title": "Костёр", "artist": "HENSY & Клава Кока", "year": 2021},
      {"title": "Сделай громче", "artist": "Клава Кока", "year": 2021},
      {"title": "Ледяной", "artist": "Клава Кока", "year": 2021},
      {"title": "Мальчик", "artist": "Dabro", "year": 2021},
      {"title": "На часах ноль-ноль", "artist": "Dabro", "year": 2021},
      {"title": "Фингер", "artist": "Dabro", "year": 2021},
      {"title": "Ты мне не пара", "artist": "Dabro", "year": 2021},
      {"title": "Я тебя найду", "artist": "Dabro", "year": 2021},
      {"title": "Обещай", "artist": "Dabro", "year": 2021},
      {"title": "Лови момент", "artist": "Dabro", "year": 2021},
      {"title": "По барам", "artist": "ANNA ASTI", "year": 2021},
      {"title": "Под этим солнцем", "artist": "Zivert", "year": 2021},
      {"title": "Зеленые глаза", "artist": "Zivert", "year": 2021},
    ];
    const MUSIC_2021_LABELS = MUSIC_2021_CATALOG.map((x, i) => `${i + 1}. ${x.artist} — ${x.title}`);

    // ========== ICONS ==========
    const ICONS = {
      home: '<path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      message: '<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.5-.7L4 20l1.2-3A7.3 7.3 0 0 1 4.5 7.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"/>',
      camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 4 8Z"/><circle cx="12" cy="13.5" r="3.5"/>',
      image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 4.5-4.5L12 16l2.5-2.5L20 19"/>',
      refresh: '<path d="M20 11a8 8 0 0 0-14.9-3L3 11"/><path d="M3 5v6h6"/><path d="M4 13a8 8 0 0 0 14.9 3L21 13"/><path d="M21 19v-6h-6"/>',
      heart: '<path d="M20.8 8.4c0 5.2-8.8 10.1-8.8 10.1S3.2 13.6 3.2 8.4A4.5 4.5 0 0 1 12 6.2a4.5 4.5 0 0 1 8.8 2.2Z"/>',
      heartFill: '<path d="m12 20.2-1.1-.8C5.2 15.5 2 12.1 2 8.7 2 5.9 4.2 3.8 7 3.8c1.6 0 3.2.8 4 2 0.8-1.2 2.4-2 4-2 2.8 0 5 2.1 5 4.9 0 3.4-3.2 6.8-8.9 10.7Z" fill="currentColor" stroke="currentColor"/>',
      share: '<path d="m14 5 5 5-5 5"/><path d="M19 10h-8a6 6 0 0 0-6 6v2"/>',
      more: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
      settings: '<path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>',
      volume: '<path d="M5 10v4h3l4 3V7l-4 3H5Z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18 7a7 7 0 0 1 0 10"/>',
      volumeOff: '<path d="M5 10v4h3l4 3V7l-4 3H5Z"/><path d="m17 9 4 6m0-6-4 6"/>',
      bookmark: '<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3-6 3Z"/>',
      bookmarkFill: '<path d="M7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3-6 3V4.5A1.5 1.5 0 0 1 7.5 3Z" fill="currentColor" stroke="currentColor"/>',
      flag: '<path d="M5 21V4"/><path d="M5 5c4-3 7 2 13-1v8c-6 3-9-2-13 1"/>',
      users: '<path d="M16 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 19.5V21"/><circle cx="10" cy="7" r="3.5"/><path d="M16 3.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a4.5 4.5 0 0 1 3 4.2V21"/>',
      handshake: '<path d="m3 12 3-3 4 2 2-2 4 2 5-3"/><path d="m7 15 3 3 2-2 2 2 5-5"/><path d="M3 12v4l4 4"/><path d="M21 8v5l-4 4"/>',
      eye: '<path d="M2.5 12s3.2-6 9.5-6 9.5 6 9.5 6-3.2 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
      music: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
      back: '<path d="m15 18-6-6 6-6"/>',
      play: '<path d="m8 5 11 7-11 7z" fill="currentColor" stroke="currentColor"/>',
      pause: '<path d="M8 5v14M16 5v14"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
      close: '<path d="m7 7 10 10M17 7 7 17"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      send: '<path d="m4 5 16 7-16 7 3-7z"/><path d="M7 12h13"/>',
      sticker: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H13l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 12.5Z"/><circle cx="9" cy="9" r=".8" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r=".8" fill="currentColor" stroke="none"/><path d="M8 11.5c1.1 1.1 2.9 1.1 4 0"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      userPlus: '<path d="M15 21v-1.5A4.5 4.5 0 0 0 10.5 15h-1A4.5 4.5 0 0 0 5 19.5V21"/><circle cx="10" cy="7" r="3"/><path d="M19 8v6M16 11h6"/>',
      alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
      user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',
      lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
      link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>',
      donate: '<path d="M7.5 8.5h9a3.5 3.5 0 0 1 0 7h-9a3.5 3.5 0 0 1 0-7Z"/><path d="M12 11v2M13.4 12c0-.7-.6-1-1.4-1s-1.4.3-1.4 1 .6 1 1.4 1 1.4.3 1.4 1-.6 1-1.4 1-1.4-.3-1.4-1M12 5v3M12 16v3"/>'
    };

    function icon(name, size = 24, className = '') {
      const body = ICONS[name] || ICONS.alert;
      return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
    }

    function hydrateIcons(root = document) {
      root.querySelectorAll('[data-icon]').forEach(el => {
        const name = el.dataset.icon;
        if (!name || el.dataset.hydrated === '1') return;
        el.innerHTML = icon(name);
        el.dataset.hydrated = '1';
      });
    }

    let users = [];
    let currentUser = {
      id: null,
      name: "Гость",
      username: "guest",
      avatar: null,
      followers: 0,
      following: 0,
      likes: 0,
      bio: "Войдите, чтобы публиковать и взаимодействовать с видео"
    };

    let videos = [];
    let currentFeedTab = "foryou";
    let currentProfile = null;
    let currentVideoIndex = 0;
    let mediaStream = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let isRecording = false;
    let recordStart = 0;
    let recordInterval = null;
    let pendingVideoBlob = null;
    let pendingVideoUrl = null;
    let pendingThumbnailBlob = null;
    let pendingThumbnailUrl = null;
    let pendingCoverBlob = null;
    let pendingCoverUrl = null;
    let currentCameraFacingMode = 'user';
    let cameraZoom = 1;
    let cameraZoomMin = 1;
    let cameraZoomMax = 1;
    let cameraZoomStep = 0.1;
    let cameraHardwareZoom = false;
    let currentCommentsVideoId = null;
    let currentMoreVideoId = null;
    let currentCommentContextId = null;
    let currentCommentContextStickerId = null;
    let currentCommentContextStickerUrl = '';
    let commentLongPressTimer = null;
    let currentStickerTab = 'stickers';
    let currentShareVideoId = null;
    const customStickers = new Map();
    let customStickerUploadBusy = false;
    const hiddenCommentIds = new Set();
    const likedCommentIds = new Set();
    let feedObserver = null;
    let authUser = null;
    let authMode = "signin";
    let pendingConfirmationEmail = '';
    let recoveryEmail = '';
    let recoveryVerified = false;
    let recoveryResendTimer = null;
    let resendCooldownTimer = null;

    // Safely stop the password-recovery resend timer from any UI handler.
    // The current recovery flow uses a link, not a verification code, so this
    // timer is normally unused; keeping the cleanup function prevents a modal
    // close from throwing and blocking the auth window.
    function stopRecoveryResendTimer() {
      if (recoveryResendTimer) {
        clearInterval(recoveryResendTimer);
        recoveryResendTimer = null;
      }
    }
    let remoteLoaded = false;
    const followingIds = new Set();
    const friendIds = new Set();
    let isRefreshingFeed = false;
    let feedRefreshNonce = 0;
    let refreshStartY = 0;
    let refreshTracking = false;
    const profileCache = new Map();
    const viewedVideos = new Set();

    // ========== PERFORMANCE ==========
    // Keep every feature, but adapt rendering effects to the device.
    const APP_PERFORMANCE = (() => {
      try {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const cores = Number(navigator.hardwareConcurrency || 0);
        const memory = Number(navigator.deviceMemory || 0);
        const saveData = Boolean(connection?.saveData);
        const slowConnection = ['slow-2g', '2g'].includes(connection?.effectiveType);
        const low = saveData || slowConnection || (cores > 0 && cores <= 4) || (memory > 0 && memory <= 4);
        return { low, cores, memory, saveData };
      } catch (_) {
        return { low: false, cores: 0, memory: 0, saveData: false };
      }
    })();
    document.documentElement.classList.toggle('low-performance', APP_PERFORMANCE.low);

    let profileEditOriginal = null;
    let profileEditAvatarUrl = '';
    let profileEditSelectedFile = null;
    let profileEditObjectUrl = '';
    let profileEditBusy = false;
    let donationSyncTimer = null;
    let donationRealtimeChannel = null;

    // ========== UTILITIES ==========
    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
    }

    function safeUrl(value) {
      if (!value) return '';
      return rewriteSupabaseUrl(value);
    }

    function fallbackAvatar(name = 'Пользователь') {
      const letter = escapeHtml(String(name).trim().charAt(0).toUpperCase() || 'П');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="#242424"/><text x="80" y="98" text-anchor="middle" font-family="Arial, sans-serif" font-size="68" font-weight="700" fill="#ffffff">${letter}</text></svg>`;
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    }

    // Profile loading intentionally uses `select('*')` here: optional fields vary
    // between deployed schemas, while userFromProfile() already handles missing fields.
    async function fetchProfilesByIds(ids) {
      const cleanIds = [...new Set((ids || []).map(x => String(x || '').trim()).filter(Boolean))];
      if (!cleanIds.length) return [];

      // Do not hard-code optional profile columns here. PostgREST returns HTTP 400
      // when even one requested column is missing from an older schema. `select('*')`
      // keeps profile loading compatible across deployed schemas while userFromProfile()
      // safely handles absent optional fields.
      const { data, error } = await db.from('profiles').select('*').in('id', cleanIds);
      if (!error) return data || [];

      console.warn('Profile load:', {
        code: error?.code || '',
        status: error?.status || 0,
        message: error?.message || String(error)
      });

      // A final minimal retry helps with unusual PostgREST views that do not accept '*'.
      try {
        const { data: minimal, error: minimalError } = await db
          .from('profiles')
          .select('id,username,display_name,avatar_url')
          .in('id', cleanIds);
        if (!minimalError) return minimal || [];
      } catch (_) {}

      throw error;
    }

    async function fetchProfileById(id) {
      const key = String(id || '').trim();
      if (!key) return null;
      const rows = await fetchProfilesByIds([key]);
      return rows.find(row => String(row?.id) === key) || null;
    }

    function userFromProfile(profile) {
      return {
        id: profile.id,
        name: profile.display_name || profile.name || 'Пользователь',
        username: profile.username || `user_${String(profile.id).slice(0, 6)}`,
        avatar: safeUrl(profile.avatar_url) || fallbackAvatar(profile.display_name || profile.name),
        followers: Number(profile.followers_count || 0),
        following: Number(profile.following_count || 0),
        likes: Number(profile.likes_count || 0),
        videosCount: Number(profile.videos_count || 0),
        bio: profile.bio || '',
        isPrivate: Boolean(profile.is_private),
        hideLikes: Boolean(profile.hide_likes),
        whoCanComment: profile.who_can_comment || 'all',
        whoCanMessage: profile.who_can_message || 'all',
        whoCanDuet: profile.who_can_duet || 'all',
        allowDownloads: profile.allow_downloads !== false,
        isVerified: Boolean(profile.is_verified),
        donationUsername: profile.donationalerts_username || '',
        donationEnabled: Boolean(profile.donationalerts_enabled),
        donationConnected: Boolean(profile.donationalerts_connected),
        profileEditLastAt: profile.profile_edit_last_at || null,
        role: profile.role || 'user',
        isBanned: Boolean(profile.is_banned),
        banReason: profile.ban_reason || '',
        warningCount: Number(profile.warning_count || 0)
      };
    }


    function showToast(message) {
      let toast = document.getElementById('appToast');
      if (!toast) {
        toast = document.createElement('div');
        toast.id = 'appToast';
        toast.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:700;background:rgba(25,25,25,.96);color:#fff;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 14px;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.35);max-width:84%;text-align:center;pointer-events:none;';
        document.getElementById('app').appendChild(toast);
      }
      toast.textContent = message;
      toast.style.display = 'block';
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => { toast.style.display = 'none'; }, 2200);
    }

    function formatCount(n) {
      const num = Number(n || 0);
      if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0','') + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1).replace('.0','') + 'K';
      return String(num);
    }

    function parseTags(value) {
      const found = String(value || '').match(/#[^\s#]+/g) || [];
      return [...new Set(found.map(x => x.trim()).filter(Boolean))].slice(0, 30);
    }

    function getMediaSrc(row) {
      const raw = String(row?.media_url || row?.video_url || row?.image_url || '').trim();
      if (!raw) return '';

      // Старые публикации могут хранить только имя/путь объекта,
      // а не полный URL. Для таких значений строим публичный адрес хранения.
      const absolute = safeUrl(raw);
      if (absolute) return absolute;

      const cleanPath = raw.replace(/^\/+/, '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
      return cleanPath
        ? `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${cleanPath}`
        : '';
    }

    function normalizeVideo(row) {
      const author = profileCache.get(row.user_id) || {
        id: row.user_id,
        name: row.username || 'Пользователь',
        username: row.username || 'user',
        avatar: fallbackAvatar(row.username || 'Пользователь'),
        followers: 0, following: 0, likes: 0, bio: ''
      };
      const tags = Array.isArray(row.hashtags) && row.hashtags.length ? row.hashtags : (Array.isArray(row.tags) ? row.tags : []);
      return {
        id: row.id,
        src: getMediaSrc(row),
        mediaType: row.media_type || (row.image_url ? 'image' : 'video'),
        author,
        authorId: row.user_id,
        desc: row.description || '',
        hashtags: tags.join(' '),
        likes: Number(row.likes_count ?? row.likes ?? 0),
        comments: Number(row.comments_count ?? 0),
        shares: Number(row.shares_count ?? row.shares ?? 0),
        views: Number(row.views_count ?? row.views ?? 0),
        liked: false,
        subscribed: false,
        favorited: false,
        isMine: Boolean(authUser && row.user_id === authUser.id),
        remote: true,
        createdAt: row.created_at,
        music: row.sound_name || row.sound || 'Оригинальный звук',
        title: row.title || 'Без названия',
        thumbnail: safeUrl(row.thumbnail_url || (row.media_type === 'image' ? row.image_url : '')),
        duration: Number(row.duration_seconds ?? row.duration ?? 0)
      };
    }

    function isRemoteVideo(v) {
      return Boolean(v?.remote && /^[0-9a-f-]{30,}$/i.test(String(v.id || '')));
    }

    function getAuthRedirectUrl() {
      const url = new URL(window.location.href);
      url.hash = '';
      url.search = '';
      return url.href;
    }

    async function handleAuthCallback() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (code) {
        const { error } = await db.auth.exchangeCodeForSession(code);
        if (error) {
          console.warn('Auth callback exchange failed:', error);
          showToast('Не удалось завершить подтверждение. Откройте ссылку из письма ещё раз.');
        } else {
          url.searchParams.delete('code');
          url.searchParams.delete('type');
          url.searchParams.delete('next');
          window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? '?' + url.searchParams.toString() : '') + url.hash);
        }
      }
      await db.auth.getSession();
    }

    async function requireAuth(action = 'это действие') {
      const { data } = await db.auth.getSession();
      authUser = data?.session?.user || null;
      if (!authUser) {
        openAuthModal(action);
        return null;
      }
      return authUser;
    }

