// ========== SUPABASE ==========
    const SUPABASE_URL = "https://xzaryhtrzdjrrqgrowkv.supabase.co";
    const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_EwldCPF1drff-q6Ei5zYcQ__is80B0T";
    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const STORAGE_BUCKET = "smotry-videos";

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

    // ========== DEMO FALLBACK DATA ==========
    const sampleVideos = [
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
      "https://uploads.video-commander.com/sample/BigBuckBunny.mp4",
      "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm"
    ];

    const avatars = [
      "https://i.pravatar.cc/150?img=1",
      "https://i.pravatar.cc/150?img=5",
      "https://i.pravatar.cc/150?img=8",
      "https://i.pravatar.cc/150?img=11",
      "https://i.pravatar.cc/150?img=12",
      "https://i.pravatar.cc/150?img=15",
      "https://i.pravatar.cc/150?img=20",
      "https://i.pravatar.cc/150?img=25",
      "https://i.pravatar.cc/150?img=32",
      "https://i.pravatar.cc/150?img=33"
    ];

    const demoUsers = [
      { id: "demo-1", name: "Анна Козлова", username: "anna_k", avatar: avatars[0], followers: 12400, following: 312, likes: 89000, bio: "Танцы • Путешествия" },
      { id: "demo-2", name: "Максим Петров", username: "maxp", avatar: avatars[1], followers: 5600, following: 180, likes: 23000, bio: "Геймер и стример" },
      { id: "demo-3", name: "София Ли", username: "sofiali", avatar: avatars[2], followers: 89000, following: 45, likes: 1200000, bio: "Креатор • Мода" },
      { id: "demo-4", name: "Игорь Волков", username: "igorv", avatar: avatars[3], followers: 3200, following: 500, likes: 15000, bio: "Музыка каждый день" },
      { id: "demo-5", name: "Елена Смирнова", username: "elena_s", avatar: avatars[4], followers: 21000, following: 220, likes: 450000, bio: "Кулинария и лайфхаки" },
      { id: "demo-6", name: "Дмитрий К.", username: "dimak", avatar: avatars[5], followers: 7800, following: 150, likes: 67000, bio: "Спорт • Мотивация" },
      { id: "demo-7", name: "Мария Иванова", username: "mari_i", avatar: avatars[6], followers: 45000, following: 90, likes: 890000, bio: "Бьюти и стиль" },
      { id: "demo-8", name: "Алекс Т.", username: "alext", avatar: avatars[7], followers: 1500, following: 400, likes: 8000, bio: "Путешествия по миру" }
    ];

    let users = [...demoUsers];
    let currentUser = {
      id: null,
      name: "Гость",
      username: "guest",
      avatar: avatars[8],
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
    let remoteLoaded = false;
    const followingIds = new Set();
    const friendIds = new Set();
    let isRefreshingFeed = false;
    let feedRefreshNonce = 0;
    let refreshStartY = 0;
    let refreshTracking = false;
    const profileCache = new Map();
    const viewedVideos = new Set();
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
      try {
        const u = new URL(value, window.location.href);
        if (u.protocol === 'https:' || u.protocol === 'http:') return u.href;
      } catch (_) {}
      return '';
    }

    function fallbackAvatar(name = 'Пользователь') {
      const letter = escapeHtml(String(name).trim().charAt(0).toUpperCase() || 'П');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="#242424"/><text x="80" y="98" text-anchor="middle" font-family="Arial, sans-serif" font-size="68" font-weight="700" fill="#ffffff">${letter}</text></svg>`;
      return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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

    function setDbStatus(text, ok = false) {
      const el = document.getElementById('dbStatus');
      if (!el) return;
      el.textContent = text;
      el.classList.toggle('ok', ok);
      el.classList.toggle('warn', !ok);
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
      return safeUrl(row.media_url || row.video_url || row.image_url || '');
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

    function generateDemoVideos() {
      const descs = [
        'Новый день — новые вайбы',
        'Как вам такой переход?',
        'Утро начинается с кофе',
        'Тренировка дня',
        'Этот звук взорвал интернет',
        'Путешествие мечты',
        'Готовлю любимое блюдо',
        'Закулисье съёмок'
      ];
      const tags = ['#fyp', '#viral', '#тренды', '#музыка', '#спорт'];
      videos = Array.from({length: 8}, (_, i) => {
        const author = users[i % users.length];
        return {
          id: `demo_v${i}`,
          src: sampleVideos[i % sampleVideos.length],
          mediaType: 'video',
          author,
          authorId: author.id,
          desc: descs[i % descs.length],
          hashtags: tags.slice(0, 2 + (i % 3)).join(' '),
          likes: 2400 + i * 311,
          comments: 80 + i * 9,
          shares: 20 + i * 5,
          views: 12000 + i * 1600,
          liked: false,
          subscribed: false,
          favorited: false,
          isMine: false,
          remote: false,
          music: 'Оригинальный звук',
          title: 'Демо-видео',
          duration: 10
        };
      });
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

