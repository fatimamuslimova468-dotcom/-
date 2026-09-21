    // ========== NAVIGATION ==========
    let currentScreenName = 'feed';
    let navigationReady = false;

    function syncVirtualBack(name) {
      const btn = document.getElementById('virtualBack');
      if (!btn) return;
      btn.classList.toggle('visible', name !== 'feed');
    }

    function showScreen(name, options = {}) {
      const { push = true } = options;
      const target = document.getElementById(name + '-screen');
      if (!target) return;

      if (push && navigationReady && currentScreenName !== name) {
        window.history.pushState({ appScreen: name }, '', window.location.href);
      }

      currentScreenName = name;
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      target.classList.add('active');
      document.querySelectorAll('.bottom-nav .btn').forEach(b => b.classList.toggle('active', b.dataset.screen === name));
      syncVirtualBack(name);

      const bottomNav = document.getElementById('bottomNav');
      if (bottomNav) bottomNav.style.display = (name === 'create' || name === 'publish') ? 'none' : 'flex';

      if (name === 'feed') playVisibleVideo(); else pauseAllVideos();
      if (name === 'create') startCamera(); else stopCamera();
      if (name === 'inbox') renderInbox();
      if (name === 'search') renderSearchSuggestions();
      if (name === 'profile') {
        if (!currentProfile) currentProfile = authUser ? currentUser : currentUser;
        if (currentProfile) renderProfileGrid('videos');
      }
      if (name === 'settings') pauseAllVideos();
    }

    function hasVisibleModal() {
      return Boolean(document.querySelector('.modal-overlay.visible'));
    }

    function goBack() {
      if (hasVisibleModal()) {
        closeModals();
        return;
      }
      if (currentScreenName === 'feed') return;
      if (window.history.length > 1) window.history.back();
      else showScreen('feed', { push: false });
    }

    function setupNavigationHistory() {
      const state = window.history.state;
      if (!state || !state.appScreen) {
        window.history.replaceState({ appScreen: currentScreenName }, '', window.location.href);
      } else if (state.appScreen) {
        currentScreenName = state.appScreen;
      }
      navigationReady = true;

      window.addEventListener('popstate', event => {
        // Android/browser system Back first reaches this handler. If a modal is open,
        // close only the modal and keep the user on the same screen.
        if (hasVisibleModal()) {
          closeModals();
          window.history.pushState({ appScreen: currentScreenName }, '', window.location.href);
          return;
        }
        const next = event.state?.appScreen || 'feed';
        showScreen(next, { push: false });
      });

      document.getElementById('virtualBack')?.addEventListener('click', goBack);

      // Existing in-app back buttons should use the same history stack as the
      // physical Android/browser Back button.
      document.addEventListener('click', event => {
        const back = event.target.closest('.back, .profile-back, .settings-back');
        if (!back) return;
        event.preventDefault();
        event.stopPropagation();
        goBack();
      }, true);
    }

    function setupBottomNav() {
      document.querySelectorAll('.bottom-nav .btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const screen = btn.dataset.screen;
          if (screen === 'create') showScreen('create');
          else if (screen === 'feed') { currentFeedTab = 'foryou'; updateTopTabs(); showScreen('feed'); renderFeed(); }
          else if (screen === 'profile') {
            currentProfile = authUser ? currentUser : currentUser;
            showScreen('profile');
            openProfile(currentProfile?.id || null);
          }
          else showScreen(screen);
        });
      });
    }

    function setupTopTabs() {
      document.querySelectorAll('.top-nav .tab').forEach(tab => {
        tab.addEventListener('click', () => {
          currentFeedTab = tab.dataset.tab;
          updateTopTabs();
          renderFeed();
        });
      });
    }

    function updateTopTabs() {
      document.querySelectorAll('.top-nav .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === currentFeedTab));
    }

    // ========== FEED ==========
    function setupMediaLoading(root) {
      root.querySelectorAll('.video-card').forEach(card => {
        const media = card.querySelector('video, img');
        const loader = card.querySelector('.video-loading');
        if (!media || !loader) return;
        const hide = () => loader.classList.add('hidden');
        if (media.tagName === 'IMG') {
          if (media.complete && media.naturalWidth > 0) hide();
          else {
            media.addEventListener('load', hide, { once: true });
            media.addEventListener('error', hide, { once: true });
          }
        } else {
          if (media.readyState >= 2) hide();
          else {
            media.addEventListener('loadeddata', hide, { once: true });
            media.addEventListener('canplay', hide, { once: true });
            media.addEventListener('error', hide, { once: true });
          }
        }
      });
    }

    function setFeedRefreshing(active) {
      isRefreshingFeed = active;
      const indicator = document.getElementById('feedRefreshIndicator');
      if (indicator) indicator.classList.toggle('visible', active);
    }

    async function refreshFeed() {
      if (isRefreshingFeed) return;
      const container = document.getElementById('feedContainer');
      const button = document.getElementById('feedRefreshBtn');
      const indicator = document.getElementById('feedRefreshIndicator');
      feedRefreshNonce += 1;
      if (indicator) {
        indicator.style.transform = '';
        const label = indicator.querySelector('span:last-child');
        if (label) label.textContent = 'Обновление ленты…';
      }
      setFeedRefreshing(true);
      button?.classList.add('spinning');
      try {
        await loadRemoteData({ force: true, refreshNonce: feedRefreshNonce });
        if (container) {
          requestAnimationFrame(() => container.scrollTo({ top: 0, behavior: 'smooth' }));
        }
        showToast('Лента обновлена. Видео перемешаны.');
      } catch (error) {
        console.error('Feed refresh error:', error);
        showToast('Не удалось обновить ленту.');
      } finally {
        setTimeout(() => {
          setFeedRefreshing(false);
          button?.classList.remove('spinning');
        }, 450);
      }
    }

    function setupFeedRefresh() {
      const container = document.getElementById('feedContainer');
      if (!container || container.dataset.refreshBound) return;
      container.dataset.refreshBound = '1';
      const refreshButton = document.getElementById('feedRefreshBtn');
      refreshButton?.addEventListener('click', () => refreshFeed());
      try { container.style.overscrollBehaviorY = 'contain'; } catch (_) {}

      const start = y => {
        if (isRefreshingFeed) return;
        const screen = document.getElementById('feed-screen');
        if (!screen?.classList.contains('active')) return;
        if (container.scrollTop <= 3) {
          refreshStartY = y;
          refreshTracking = true;
        }
      };
      const move = y => {
        if (!refreshTracking || isRefreshingFeed) return;
        const delta = y - refreshStartY;
        if (delta > 8 && container.scrollTop <= 3) {
          const indicator = document.getElementById('feedRefreshIndicator');
          if (indicator) {
            indicator.classList.add('visible');
            indicator.style.transform = `translateX(-50%) translateY(${Math.min(delta * 0.42, 34)}px)`;
            const label = indicator.querySelector('span:last-child');
            if (label) label.textContent = delta > 72 ? 'Отпустите для обновления' : 'Потяните для обновления';
          }
        }
      };
      const end = async y => {
        if (!refreshTracking) return;
        refreshTracking = false;
        const delta = y - refreshStartY;
        const indicator = document.getElementById('feedRefreshIndicator');
        if (delta <= 72 && indicator) {
          indicator.classList.remove('visible');
          indicator.style.transform = '';
          const label = indicator.querySelector('span:last-child');
          if (label) label.textContent = 'Обновление ленты…';
        }
        if (container.scrollTop <= 3 && delta > 72) await refreshFeed();
      };

      container.addEventListener('touchstart', e => {
        if (e.touches?.[0]) start(e.touches[0].clientY);
      }, {passive:true});
      container.addEventListener('touchmove', e => {
        if (e.touches?.[0]) move(e.touches[0].clientY);
      }, {passive:true});
      container.addEventListener('touchend', e => {
        const y = e.changedTouches?.[0]?.clientY ?? refreshStartY;
        end(y);
      }, {passive:true});
      container.addEventListener('touchcancel', () => {
        refreshTracking = false;
        const indicator = document.getElementById('feedRefreshIndicator');
        if (indicator) { indicator.classList.remove('visible'); indicator.style.transform = ''; }
      }, {passive:true});

      // Desktop trackpad/mouse support: wheel upward at the very top triggers refresh once.
      let wheelPull = 0;
      container.addEventListener('wheel', e => {
        if (container.scrollTop <= 0 && e.deltaY < 0 && !isRefreshingFeed) {
          wheelPull += Math.abs(e.deltaY);
          if (wheelPull > 120) { wheelPull = 0; refreshFeed(); }
        } else if (e.deltaY >= 0) {
          wheelPull = 0;
        }
      }, {passive:true});
    }

    let feedSoundEnabled = (() => {
      try { return localStorage.getItem('smotriuFeedSound') === '1'; } catch (_) { return false; }
    })();

    function persistFeedSound() {
      try { localStorage.setItem('smotriuFeedSound', feedSoundEnabled ? '1' : '0'); } catch (_) {}
    }

    function setVideoSound(video, enabled) {
      if (!video) return;
      video.muted = !enabled;
      video.volume = enabled ? 1 : 0;
      const button = video.closest('.video-card')?.querySelector('.video-sound-btn');
      if (button) {
        button.innerHTML = icon(enabled ? 'volume' : 'volumeOff', 21);
        button.setAttribute('aria-label', enabled ? 'Выключить звук' : 'Включить звук');
        button.setAttribute('title', enabled ? 'Выключить звук' : 'Включить звук');
      }
    }

    function toggleVideoSound(card) {
      const video = card?.querySelector('video');
      if (!video) return;
      feedSoundEnabled = !feedSoundEnabled;
      persistFeedSound();
      document.querySelectorAll('#feedContainer .video-card video').forEach(v => setVideoSound(v, feedSoundEnabled));
      if (feedSoundEnabled) {
        const playPromise = video.paused ? video.play() : Promise.resolve();
        if (playPromise?.catch) playPromise.catch(() => {});
      }
    }

    function applyFeedSoundState(root = document) {
      root.querySelectorAll('#feedContainer .video-card video').forEach(video => setVideoSound(video, feedSoundEnabled));
    }

    function renderFeed(options = {}) {
      const container = document.getElementById('feedContainer');
      if (!container) return;
      const reshuffle = options.reshuffle !== false;
      container.innerHTML = '';
      let list = reshuffle ? shuffleArray(videos) : [...videos];
      if (currentFeedTab === 'following') {
        list = authUser ? list.filter(v => followingIds.has(v.authorId)) : [];
        if (!list.length) {
          container.innerHTML = `<div class="empty-state" style="height:100%;display:flex;flex-direction:column;justify-content:center;"><div class="icon">${icon('users',48)}</div><div>${authUser ? 'Вы пока ни на кого не подписаны.' : 'Войдите, чтобы видеть видео из подписок.'}</div></div>`;
          return;
        }
      } else if (currentFeedTab === 'friends') {
        list = authUser ? list.filter(v => friendIds.has(v.authorId)) : [];
        if (!list.length) {
          container.innerHTML = `<div class="empty-state" style="height:100%;display:flex;flex-direction:column;justify-content:center;"><div class="icon">${icon('handshake',48)}</div><div>${authUser ? 'Пока нет видео от взаимных подписок.' : 'Войдите, чтобы видеть видео друзей.'}</div></div>`;
          return;
        }
      }

      if (!list.length) {
        container.innerHTML = `<div class="empty-state" style="height:100%;display:flex;flex-direction:column;justify-content:center;"><div class="icon">${icon('play',48)}</div><div>Пока нет опубликованных видео.</div><div style="margin-top:8px;font-size:12px;color:var(--text-muted);max-width:320px;text-align:center">Здесь появятся видео после публикации через Supabase.</div></div>`;
        return;
      }

      list.forEach((v, index) => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.style.animationDelay = `${Math.min(index * 18, 120)}ms`;
        card.dataset.id = v.id;
        const source = escapeHtml(v.src);
        const authorAvatar = escapeHtml(v.author.avatar || fallbackAvatar(v.author.name));
        const poster = v.thumbnail ? ` poster="${escapeHtml(v.thumbnail)}"` : '';
        const videoCover = v.thumbnail
          ? `<div class="video-cover"><img src="${escapeHtml(v.thumbnail)}" alt="" /></div>`
          : `<div class="video-cover" aria-hidden="true"></div>`;
        const media = v.mediaType === 'image'
          ? `<div class="video-loading"><span class="loading-spinner"></span></div><img src="${source}" alt="" style="width:100%;height:100%;object-fit:cover;background:#000;" />`
          : `<div class="video-loading"><span class="loading-spinner"></span></div>${videoCover}<video src="${source}" loop ${!feedSoundEnabled ? 'muted' : ''} playsinline ${userSettings.autoplay ? 'autoplay' : ''} preload="${userSettings.data_saver ? 'metadata' : 'auto'}" data-quality-preference="${escapeHtml(userSettings.video_quality || 'auto')}"${poster}></video>`;
        const likeIcon = v.liked ? icon('heartFill', 25) : icon('heart', 25);
        const saveBadge = v.favorited ? ' saved' : '';
        card.innerHTML = `
          ${media}
          <div class="video-pause-indicator" aria-hidden="true"><div class="pause-badge">${icon('pause',26)}</div></div>
          <div class="video-overlay">
            <button class="subscribe-btn ${v.subscribed ? 'subscribed' : ''}" data-id="${escapeHtml(v.id)}" ${v.isMine ? 'disabled' : ''}>
              ${v.subscribed ? `${icon('check',14)} Подписан` : `${icon('userPlus',14)} Подписаться`}
            </button>
            <button class="video-sound-btn" type="button" aria-label="${feedSoundEnabled ? 'Выключить звук' : 'Включить звук'}" title="${feedSoundEnabled ? 'Выключить звук' : 'Включить звук'}">${icon(feedSoundEnabled ? 'volume' : 'volumeOff',21)}</button>
           <div class="side-actions">
              <div class="side-action author-avatar" data-userid="${escapeHtml(v.author.id)}">
                <div class="avatar-wrap">
                  <img src="${authorAvatar}" alt="" />
                  ${!v.subscribed && !v.isMine ? `<div class="avatar-follow">${icon('plus',12)}</div>` : ''}
                </div>
              </div>
              <div class="side-action like-btn" data-id="${escapeHtml(v.id)}">
                <div class="icon-btn ${v.liked ? 'liked' : ''}">${likeIcon}</div>
                <div class="count">${formatCount(v.likes)}</div>
              </div>
              <div class="side-action comment-btn" data-id="${escapeHtml(v.id)}">
                <div class="icon-btn">${icon('message',24)}</div>
                <div class="count">${formatCount(v.comments)}</div>
              </div>
              <div class="side-action share-btn" data-id="${escapeHtml(v.id)}">
                <div class="icon-btn">${icon('share',24)}</div>
                <div class="count">${formatCount(v.shares)}</div>
              </div>
              ${v.author?.donationEnabled && v.author?.donationUsername ? `<div class="side-action donate-btn" data-id="${escapeHtml(v.id)}" title="Поддержать автора">
                <div class="icon-btn">${icon('donate',23)}</div>
                <div class="count">Донат</div>
              </div>` : ''}
              <div class="side-action more-btn" data-id="${escapeHtml(v.id)}">
                <div class="icon-btn${(!v.isMine && v.favorited) ? saveBadge : ''}">${v.isMine ? icon('more',24) : (v.favorited ? icon('bookmarkFill',23) : icon('more',24))}</div>
              </div>
            </div>
            <div class="video-info">
              <div class="author" data-userid="${escapeHtml(v.author.id)}">@${escapeHtml(v.author.username)}${v.author.isVerified ? ` <span style="opacity:.95">${icon('check',13)}</span>` : ''}</div>
              <div class="desc">${escapeHtml(v.desc)}</div>
              <div class="hashtags">${escapeHtml(v.hashtags || '')}</div>
              <div class="music">${icon('music',14)} ${escapeHtml(v.music || 'Оригинальный звук')}</div>
            </div>
            <div class="video-progress"><div class="bar"></div></div>
          </div>`;
        container.appendChild(card);
      });

      const endMessage = document.createElement('div');
      endMessage.className = 'feed-end-message';
      endMessage.innerHTML = `<div class="end-title">Видео больше нет</div><div class="end-subtitle">Вы дошли до конца ленты</div>`;
      container.appendChild(endMessage);

      setupMediaLoading(container);
      hydrateIcons(container);
      applyFeedSoundState(container);
      applyPlaybackSettings();

      container.onclick = async (e) => {
        const soundButton = e.target.closest('.video-sound-btn');
        if (soundButton) {
          e.preventDefault();
          e.stopPropagation();
          toggleVideoSound(soundButton.closest('.video-card'));
          return;
        }
        const target = e.target.closest('[data-id], [data-userid], .subscribe-btn, .like-btn, .comment-btn, .share-btn, .donate-btn, .more-btn, .author, .author-avatar');
        if (!target) return;
        if (target.classList.contains('subscribe-btn') || target.closest('.subscribe-btn')) {
          const btn = target.classList.contains('subscribe-btn') ? target : target.closest('.subscribe-btn');
          await toggleSubscribe(btn.dataset.id); return;
        }
        if (target.classList.contains('like-btn') || target.closest('.like-btn')) {
          await toggleLike(target.closest('.like-btn').dataset.id); return;
        }
        if (target.classList.contains('comment-btn') || target.closest('.comment-btn')) {
          await openComments(target.closest('.comment-btn').dataset.id); return;
        }
        if (target.classList.contains('share-btn') || target.closest('.share-btn')) {
          openShareModal(target.closest('.share-btn').dataset.id); return;
        }
        if (target.classList.contains('donate-btn') || target.closest('.donate-btn')) {
          await openDonationForVideo(target.closest('.donate-btn').dataset.id); return;
        }
        if (target.classList.contains('more-btn') || target.closest('.more-btn')) {
          openMore(target.closest('.more-btn').dataset.id); return;
        }
        const userTarget = target.dataset.userid ? target : target.closest('[data-userid]');
        if (userTarget?.dataset.userid) openProfile(userTarget.dataset.userid);
      };

      if (feedObserver) feedObserver.disconnect();
      feedObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const media = entry.target.querySelector('video');
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            if (media && userSettings.autoplay) {
              media.play().catch(() => {});
              entry.target.querySelector('.video-pause-indicator')?.classList.remove('visible');
              updateProgress(media, entry.target);
            }
            recordView(entry.target.dataset.id);
          } else if (media) {
            media.pause();
            entry.target.querySelector('.video-pause-indicator')?.classList.remove('visible');
          }
        });

        container.querySelectorAll('.video-card video').forEach(video => {
          if (video.dataset.coverBound === '1') return;
          video.dataset.coverBound = '1';
          video.addEventListener('playing', () => {
            video.closest('.video-card')?.classList.add('video-started');
          });
          video.addEventListener('error', () => {
            video.closest('.video-card')?.classList.remove('video-started');
          });
        });
      }, { threshold: [0.6] });
      container.querySelectorAll('.video-card').forEach(card => feedObserver.observe(card));

      let lastTap = 0;
      let tapTimer = null;
      container.addEventListener('click', e => {
        if (e.target.closest('.side-actions, .subscribe-btn, .video-info, button, a')) return;
        const card = e.target.closest('.video-card');
        if (!card) return;
        const media = card.querySelector('video');
        if (!media) return;
        const now = Date.now();
        if (now - lastTap < 320) {
          clearTimeout(tapTimer);
          tapTimer = null;
          toggleLike(card.dataset.id, true);
          lastTap = 0;
          return;
        }
        lastTap = now;
        clearTimeout(tapTimer);
        tapTimer = setTimeout(() => {
          toggleVideoPause(card);
          tapTimer = null;
          lastTap = 0;
        }, 170);
      });
    }

    function toggleVideoPause(card) {
      const video = card?.querySelector('video');
      if (!video) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
      card.querySelector('.video-pause-indicator')?.classList.toggle('visible', video.paused);
    }

    function updateProgress(video, card) {
      const bar = card.querySelector('.video-progress .bar');
      if (!bar) return;
      const update = () => {
        if (video.duration) bar.style.width = `${(video.currentTime / video.duration) * 100}%`;
        if (!video.paused) requestAnimationFrame(update);
      };
      requestAnimationFrame(update);
    }

    function playVisibleVideo() {
      document.querySelectorAll('.video-card').forEach(card => {
        const media = card.querySelector('video');
        if (!media) return;
        const rect = card.getBoundingClientRect();
        if (userSettings.autoplay && rect.top >= -50 && rect.top < window.innerHeight / 2) media.play().catch(() => {}); else if (!userSettings.autoplay) media.pause(); else media.pause();
      });
    }

    function pauseAllVideos() {
      document.querySelectorAll('video').forEach(v => { if (v.id !== 'cameraPreview') v.pause(); });
    }

    async function recordView(videoId) {
      if (viewedVideos.has(videoId) || !isRemoteVideo(videos.find(v => v.id === videoId))) return;
      viewedVideos.add(videoId);
      try {
        if (authUser) await db.rpc('record_video_view', { p_video_id: videoId, p_session_id: getSessionId() });
        else await db.from('views').insert({ video_id: videoId, user_id: null, watched_seconds: 0, completed: false });
      } catch (_) {}
    }

    function getSessionId() {
      let id = localStorage.getItem('videoPlatformSessionId');
      if (!id) { id = crypto.randomUUID(); localStorage.setItem('videoPlatformSessionId', id); }
      return id;
    }

    async function toggleLike(id, force = false) {
      const v = videos.find(x => x.id === id);
      if (!v) return;
      if (force && v.liked) return;
      const user = await requireAuth('поставить лайк');
      if (!user) return;
      const next = !v.liked;
      try {
        if (next) {
          const { error } = await db.from('likes').insert({ user_id: user.id, video_id: id });
          if (error && error.code !== '23505') throw error;
        } else {
          const { error } = await db.from('likes').delete().eq('user_id', user.id).eq('video_id', id);
          if (error) throw error;
        }
        v.liked = next;
        v.likes = Math.max(0, v.likes + (next ? 1 : -1));
        updateLikeButton(v);
        if (v.remote) await refreshVideo(id);
        updateLikeButton(videos.find(x => x.id === id));
      } catch (error) {
        console.error(error);
        showToast('Не удалось изменить лайк.');
      }
    }

    function updateLikeButton(v) {
      if (!v) return;
      const card = document.querySelector(`.video-card[data-id="${CSS.escape(v.id)}"]`);
      if (!card) return;
      const btn = card.querySelector('.like-btn .icon-btn');
      const count = card.querySelector('.like-btn .count');
      if (btn) {
        btn.classList.toggle('liked', v.liked);
        btn.innerHTML = v.liked ? icon('heartFill',25) : icon('heart',25);
      }
      if (count) count.textContent = formatCount(v.likes);
    }

    async function toggleSubscribe(id) {
      const v = videos.find(x => x.id === id);
      if (!v || v.isMine) return;
      const user = await requireAuth('подписаться на автора');
      if (!user) return;
      const authorId = v.authorId || v.author.id;
      if (String(authorId) === String(user.id)) { showToast('Нельзя подписаться на самого себя.'); return; }
      try {
        if (v.subscribed) {
          const { error } = await db.from('subscriptions').delete().eq('follower_id', user.id).eq('following_id', authorId);
          if (error) throw error;
        } else {
          const { error } = await db.from('subscriptions').insert({ follower_id: user.id, following_id: authorId });
          if (error && error.code !== '23505') throw error;
        }
        const nowSubscribed = !v.subscribed;
        videos.forEach(x => { if (x.authorId === authorId || x.author.id === authorId) x.subscribed = nowSubscribed; });
        if (nowSubscribed) followingIds.add(authorId); else { followingIds.delete(authorId); friendIds.delete(authorId); }
        const card = document.querySelector(`.video-card[data-id="${CSS.escape(id)}"]`);
        if (card) {
          const btn = card.querySelector('.subscribe-btn');
          const followBadge = card.querySelector('.avatar-follow');
          if (btn) {
            const nowSubscribed = v.subscribed;
            btn.innerHTML = nowSubscribed ? `${icon('check',14)} Подписан` : `${icon('userPlus',14)} Подписаться`;
            btn.classList.toggle('subscribed', nowSubscribed);
          }
          if (followBadge) followBadge.style.display = v.subscribed ? 'none' : 'flex';
          hydrateIcons(card);
        }
      } catch (error) {
        console.error(error);
        showToast('Не удалось изменить подписку.');
      }
    }

    function getVideoShareUrl(id) {
      return `${window.location.origin}${window.location.pathname}#video=${encodeURIComponent(id)}`;
    }

    function getVideoShareText(v, url) {
      const title = String(v?.title || 'Видео').trim();
      const desc = String(v?.desc || '').trim();
      const safeDesc = desc && desc !== title ? `\n${desc.slice(0, 180)}${desc.length > 180 ? '…' : ''}` : '';
      return `Посмотри это видео в «Смотрю» 🎬\n${title}${safeDesc}\n\n${url}\n\nПотрясающие видео из «Смотрю»`;
    }

    async function registerVideoShare(id) {
      const v = videos.find(x => x.id === id);
      if (!v) return;
      try {
        if (v.remote && authUser) {
          await db.rpc('increment_video_share', { p_video_id: id });
          await refreshVideo(id);
        } else {
          v.shares = Number(v.shares || 0) + 1;
        }
        renderFeed();
      } catch (error) {
        console.warn('Share counter update failed:', error);
      }
    }

    function openShareModal(id) {
      const v = videos.find(x => x.id === id);
      if (!v) return;
      closeModals();
      currentShareVideoId = id;
      const title = document.getElementById('sharePreviewTitle');
      const subtitle = document.getElementById('sharePreviewSubtitle');
      const thumb = document.getElementById('sharePreviewThumb');
      if (title) title.textContent = v.title || 'Видео';
      if (subtitle) subtitle.textContent = v.desc || `Видео от @${v.author?.username || v.author?.name || 'пользователя'}`;
      if (thumb) {
        const thumbUrl = safeUrl(v.thumbnail || '');
        thumb.innerHTML = thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" alt="">` : icon('play', 22);
      }
      document.getElementById('shareModal')?.classList.add('visible');
      hydrateIcons(document.getElementById('shareModal'));
    }

    async function copyShareLink(id) {
      const url = getVideoShareUrl(id);
      try {
        if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
        else {
          const input = document.createElement('textarea');
          input.value = url; input.style.position = 'fixed'; input.style.opacity = '0';
          document.body.appendChild(input); input.select(); document.execCommand('copy'); input.remove();
        }
        await registerVideoShare(id);
        showToast('Ссылка скопирована.');
      } catch (error) {
        console.error(error);
        showToast('Не удалось скопировать ссылку.');
      }
    }

    async function shareVideoTo(kind, id) {
      const v = videos.find(x => x.id === id);
      if (!v) return;
      const url = getVideoShareUrl(id);
      const text = getVideoShareText(v, url);
      const title = v.title || 'Видео из «Смотрю»';
      let targetUrl = '';

      if (kind === 'telegram') {
        targetUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text.replace(`\n\n${url}`, ''))}`;
      } else if (kind === 'whatsapp') {
        targetUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      } else if (kind === 'vk') {
        targetUrl = `https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&comment=${encodeURIComponent(text)}`;
      } else if (kind === 'email') {
        targetUrl = `mailto:?subject=${encodeURIComponent(`Видео из «Смотрю»: ${title}`)}&body=${encodeURIComponent(text)}`;
      }

      if (kind === 'copy') {
        await copyShareLink(id);
        closeModals();
        return;
      }

      if (kind === 'native') {
        if (!navigator.share) {
          showToast('Системное меню «Поделиться» недоступно в этом WebView.');
          return;
        }
        try {
          await navigator.share({ title, text });
          await registerVideoShare(id);
          closeModals();
          showToast('Готово — видео отправлено.');
        } catch (error) {
          if (error?.name !== 'AbortError') showToast('Не удалось открыть системное меню.');
        }
        return;
      }

      if (!targetUrl) return;
      try {
        const popup = window.open(targetUrl, '_blank', 'noopener,noreferrer');
        await registerVideoShare(id);
        closeModals();
        if (!popup) window.location.href = targetUrl;
      } catch (error) {
        console.error(error);
        showToast('Не удалось открыть приложение.');
      }
    }

    async function shareVideo(id) {
      openShareModal(id);
    }

    async function toggleFavorite(id) {
      const v = videos.find(x => x.id === id);
      if (!v) return;
      const user = await requireAuth('сохранить видео');
      if (!user) return;
      try {
        if (v.favorited) {
          const { error } = await db.from('saved_videos').delete().eq('user_id', user.id).eq('video_id', id);
          if (error) throw error;
        } else {
          const { error } = await db.from('saved_videos').insert({ user_id: user.id, video_id: id });
          if (error && error.code !== '23505') throw error;
        }
        v.favorited = !v.favorited;
        if (v.remote) await refreshVideo(id);
        closeModals();
        showToast(v.favorited ? 'Видео сохранено в избранное.' : 'Видео удалено из избранного.');
        renderFeed();
      } catch (error) {
        console.error(error);
        showToast('Не удалось изменить избранное.');
      }
    }

    async function reportCurrentVideo() {
      const v = videos.find(x => x.id === currentMoreVideoId);
      closeModals();
      if (!v) return;
      const user = await requireAuth('отправить жалобу');
      if (!user) return;
      try {
        const { error } = await db.from('video_reports').insert({ video_id: v.id, user_id: user.id, reason: 'other', details: '' });
        if (error) throw error;
        showToast('Жалоба отправлена.');
      } catch (error) {
        console.error(error);
        showToast('Не удалось отправить жалобу.');
      }
    }

