    // ========== AUTH ==========
    function openAuthModal(reason = '') {
      closeModals();
      setAuthMode('signin');
      const note = document.getElementById('authNote');
      note.textContent = reason ? `Чтобы ${reason}, войдите в аккаунт. Публичную ленту можно смотреть без входа.` : 'Публичную ленту можно смотреть без входа. Для действий понадобится аккаунт.';
      document.getElementById('authModal').classList.add('visible');
      document.getElementById('authEmail').focus();
      hydrateIcons(document.getElementById('authModal'));
    }

    function setAuthMode(mode) {
      authMode = mode;
      const authError = document.getElementById('authError');
      if (authError) authError.textContent = '';
      const authForgot = document.getElementById('authForgot');
      if (authForgot) authForgot.classList.toggle('hidden', mode !== 'signin');
      document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.authMode === mode));
      document.getElementById('authTitle').textContent = mode === 'signup' ? 'Создать аккаунт' : 'Вход в аккаунт';
      document.getElementById('authSubtitle').textContent = mode === 'signup'
        ? 'Создайте профиль, чтобы публиковать, сохранять и общаться.'
        : 'Ваши видео, лайки и подписки — в одном месте.';
      document.getElementById('authSubmit').textContent = mode === 'signup' ? 'Создать аккаунт' : 'Войти';
      document.getElementById('authNameField').classList.toggle('hidden', mode !== 'signup');
      document.getElementById('authPassword').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    }

    async function submitAuth() {
      const btn = document.getElementById('authSubmit');
      const email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPassword').value;
      const name = document.getElementById('authName').value.trim();
      if (!email || !password) {
        showToast('Введите email и пароль.');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Проверяем…';
      try {
        let result;
        if (authMode === 'signup') {
          result = await db.auth.signUp({ email, password, options: { data: { display_name: name || email.split('@')[0] }, emailRedirectTo: getAuthRedirectUrl() } });
          if (result.error) throw result.error;
          if (!result.data.session) {
            pendingConfirmationEmail = email;
            closeModals();
            openEmailConfirmation(email);
            return;
          }
        } else {
          result = await db.auth.signInWithPassword({ email, password });
          if (result.error) throw result.error;
        }
        authUser = result.data.user || result.data.session?.user || null;
        await ensureCurrentProfile();
        await loadRemoteData();
        closeModals();
        showToast('Вы вошли в аккаунт.');
      } catch (error) {
        console.error(error);
        const message = error?.message || 'Не удалось выполнить вход.';
        const authError = document.getElementById('authError');
        if (/invalid login credentials/i.test(message)) {
          if (authError) authError.textContent = 'Неверный email или пароль. Проверьте данные или восстановите пароль ниже.';
          return;
        }
        if (/email.*not.*confirm|not.*confirm.*email/i.test(message)) {
          pendingConfirmationEmail = email;
          closeModals();
          openEmailConfirmation(email);
          document.getElementById('emailResendHint').textContent = 'Почта ещё не подтверждена для этой учётной записи. После подтверждения войдите с этим же паролем.';
        } else {
          showToast(message);
        }
      } finally {
        btn.disabled = false;
        btn.textContent = authMode === 'signup' ? 'Создать аккаунт' : 'Войти';
      }
    }


    function setPasswordRecoveryStep(step) {
      const safeStep = Math.max(1, Math.min(3, Number(step) || 1));
      document.querySelectorAll('[data-recovery-step]').forEach(section => {
        section.classList.toggle('active', Number(section.dataset.recoveryStep) === safeStep);
      });
      document.querySelectorAll('[data-recovery-progress]').forEach(bar => {
        const n = Number(bar.dataset.recoveryProgress);
        bar.classList.toggle('active', n <= safeStep);
      });

      const title = document.getElementById('passwordRecoveryTitle');
      const subtitle = document.getElementById('passwordRecoverySubtitle');
      if (title) title.textContent = safeStep === 1 ? 'Восстановление доступа' : safeStep === 2 ? 'Введите код' : 'Новый пароль';
      if (subtitle) subtitle.textContent = safeStep === 1
        ? 'Укажите почту аккаунта — мы отправим одноразовый код для восстановления доступа.'
        : safeStep === 2
          ? 'Введите код из письма, чтобы подтвердить, что это ваша почта.'
          : 'Придумайте новый пароль и повторите его ещё раз.';

      const modal = document.getElementById('passwordResetModal');
      if (modal) hydrateIcons(modal);
    }

    function clearRecoveryMessages() {
      ['passwordResetError','recoveryCodeError','recoveryPasswordError'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
      });
    }

    function stopRecoveryResendTimer() {
      if (recoveryResendTimer) {
        clearInterval(recoveryResendTimer);
        recoveryResendTimer = null;
      }
    }

    function startRecoveryResendTimer() {
      stopRecoveryResendTimer();
      const btn = document.getElementById('recoveryResendBtn');
      const hint = document.getElementById('recoveryResendHint');
      if (!btn || !hint) return;
      let left = 60;
      btn.disabled = true;
      btn.textContent = `Отправить код снова · ${left}s`;
      hint.textContent = 'Повторная отправка доступна через минуту.';
      recoveryResendTimer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
          stopRecoveryResendTimer();
          btn.disabled = false;
          btn.textContent = 'Отправить код снова';
          hint.textContent = 'Можно запросить новый код.';
          return;
        }
        btn.textContent = `Отправить код снова · ${left}s`;
      }, 1000);
    }

    function openPasswordResetModal(prefillEmail = '') {
      closeModals();
      stopRecoveryResendTimer();
      recoveryEmail = String(prefillEmail || document.getElementById('authEmail')?.value || '').trim();
      recoveryVerified = false;
      clearRecoveryMessages();
      const email = document.getElementById('recoveryEmail');
      const code = document.getElementById('recoveryCode');
      const p1 = document.getElementById('newPassword');
      const p2 = document.getElementById('newPasswordRepeat');
      const chip = document.getElementById('recoveryEmailChip');
      if (email) email.value = recoveryEmail;
      if (code) code.value = '';
      if (p1) p1.value = '';
      if (p2) p2.value = '';
      if (chip) chip.textContent = recoveryEmail || '—';
      setPasswordRecoveryStep(1);
      document.getElementById('passwordResetModal').classList.add('visible');
      hydrateIcons(document.getElementById('passwordResetModal'));
      setTimeout(() => document.getElementById('recoveryEmail')?.focus(), 50);
    }

    async function sendPasswordReset() {
      const prefill = document.getElementById('authEmail')?.value.trim() || '';
      closeModals();
      openPasswordResetModal(prefill);
    }

    async function sendRecoveryCode(showStep = true) {
      const emailInput = document.getElementById('recoveryEmail');
      const err = document.getElementById('passwordResetError');
      const btn = document.getElementById('recoverySendBtn');
      const email = String(emailInput?.value || '').trim().toLowerCase();
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        if (err) err.textContent = 'Введите корректный email.';
        emailInput?.focus();
        return;
      }
      recoveryEmail = email;
      const chip = document.getElementById('recoveryEmailChip');
      if (chip) chip.textContent = email;
      if (btn) { btn.disabled = true; btn.textContent = 'Отправляем код…'; }
      if (err) err.textContent = '';
      try {
        const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: getAuthRedirectUrl() });
        if (error) throw error;
        showStep ? setPasswordRecoveryStep(2) : null;
        startRecoveryResendTimer();
        showToast('Если этот email зарегистрирован, код уже отправлен.');
        setTimeout(() => document.getElementById('recoveryCode')?.focus(), 60);
      } catch (error) {
        console.error('Password reset request error:', error);
        if (err) err.textContent = error?.message || 'Не удалось отправить код. Попробуйте ещё раз.';
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Получить код'; }
      }
    }

    async function verifyRecoveryCode() {
      const token = String(document.getElementById('recoveryCode')?.value || '').replace(/\D/g, '').trim();
      const err = document.getElementById('recoveryCodeError');
      const btn = document.getElementById('recoveryVerifyBtn');
      if (!recoveryEmail) {
        setPasswordRecoveryStep(1);
        return;
      }
      if (token.length < 6) {
        if (err) err.textContent = 'Введите код из письма.';
        document.getElementById('recoveryCode')?.focus();
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = 'Проверяем…'; }
      if (err) err.textContent = '';
      try {
        const { data, error } = await db.auth.verifyOtp({ email: recoveryEmail, token, type: 'recovery' });
        if (error) throw error;
        if (!data?.session?.user) throw new Error('Не удалось открыть защищённую сессию восстановления.');
        authUser = data.session.user;
        recoveryVerified = true;
        stopRecoveryResendTimer();
        setPasswordRecoveryStep(3);
        setTimeout(() => document.getElementById('newPassword')?.focus(), 60);
      } catch (error) {
        console.error('Password recovery OTP error:', error);
        if (err) err.textContent = error?.message || 'Код неверный или уже истёк. Запросите новый код.';
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Проверить код'; }
      }
    }

    async function resendRecoveryCode() {
      if (!recoveryEmail) return;
      const btn = document.getElementById('recoveryResendBtn');
      const hint = document.getElementById('recoveryResendHint');
      if (btn?.disabled) return;
      if (btn) { btn.disabled = true; btn.textContent = 'Отправляем…'; }
      if (hint) hint.textContent = '';
      try {
        const { error } = await db.auth.resetPasswordForEmail(recoveryEmail, { redirectTo: getAuthRedirectUrl() });
        if (error) throw error;
        showToast('Новый код отправлен на почту.');
        startRecoveryResendTimer();
      } catch (error) {
        console.error('Recovery resend error:', error);
        if (hint) hint.textContent = error?.message || 'Не удалось отправить новый код.';
        if (btn) { btn.disabled = false; btn.textContent = 'Отправить код снова'; }
      }
    }

    function openEmailConfirmation(email) {
      pendingConfirmationEmail = String(email || '').trim();
      document.getElementById('emailConfirmAddress').textContent = pendingConfirmationEmail || 'ваш email';
      const btn = document.getElementById('emailResendBtn');
      const hint = document.getElementById('emailResendHint');
      if (resendCooldownTimer) {
        clearInterval(resendCooldownTimer);
        resendCooldownTimer = null;
      }
      btn.disabled = false;
      btn.textContent = 'Отправить снова';
      hint.textContent = 'Проверьте папку «Спам», если письма нет во входящих.';
      document.getElementById('emailConfirmModal').classList.add('visible');
      hydrateIcons(document.getElementById('emailConfirmModal'));
    }

    async function resendConfirmationEmail() {
      const email = pendingConfirmationEmail;
      if (!email) return;
      const btn = document.getElementById('emailResendBtn');
      const hint = document.getElementById('emailResendHint');
      btn.disabled = true;
      btn.textContent = 'Отправляем…';
      hint.textContent = '';
      try {
        const { error } = await db.auth.resend({ type: 'signup', email });
        if (error) throw error;
        let left = 60;
        btn.textContent = `Отправить снова · ${left}s`;
        hint.textContent = 'Повторная отправка доступна через минуту.';
        resendCooldownTimer = setInterval(() => {
          left -= 1;
          if (left <= 0) {
            clearInterval(resendCooldownTimer);
            resendCooldownTimer = null;
            btn.disabled = false;
            btn.textContent = 'Отправить снова';
            hint.textContent = 'Можно отправить письмо ещё раз.';
            return;
          }
          btn.textContent = `Отправить снова · ${left}s`;
        }, 1000);
      } catch (error) {
        console.error('Resend confirmation error:', error);
        btn.disabled = false;
        btn.textContent = 'Отправить снова';
        hint.textContent = error?.message || 'Не удалось отправить письмо. Попробуйте ещё раз.';
      }
    }

    async function loadSavedStickers() {
      customStickers.clear();
      if (!authUser) return;
      const { data, error } = await db.from('saved_stickers').select('sticker_id,sticker_url').eq('user_id', authUser.id).order('created_at', { ascending: true });
      if (error) { console.warn('saved stickers load', error); return; }
      (data || []).forEach(row => {
        if (!row.sticker_id) return;
        const url = row.sticker_url || stickerDataUrl(row.sticker_id);
        if (!url) return;
        const builtIn = stickerById(row.sticker_id);
        customStickers.set(row.sticker_id, { url, name: builtIn?.name || 'Мой стикер' });
      });
    }

    async function ensureCurrentProfile() {
      if (!authUser) return null;
      const { data, error } = await db.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
      if (error) throw error;
      if (data) {
        const u = userFromProfile(data);
        profileCache.set(u.id, u);
        currentUser = u;
        return u;
      }
      const baseName = authUser.user_metadata?.display_name || authUser.email?.split('@')[0] || 'Пользователь';
      const baseUsername = (authUser.user_metadata?.username || authUser.email?.split('@')[0] || `user_${String(authUser.id).slice(0, 6)}`)
        .toLowerCase().replace(/[^a-z0-9_]+/g, '_').slice(0, 24) || `user_${String(authUser.id).slice(0, 6)}`;
      const insert = {
        id: authUser.id,
        name: baseName,
        display_name: baseName,
        username: baseUsername,
        bio: '',
        avatar_url: null
      };
      const created = await db.from('profiles').upsert(insert, { onConflict: 'id' }).select('*').single();
      if (created.error) throw created.error;
      const u = userFromProfile(created.data);
      profileCache.set(u.id, u);
      currentUser = u;
      return u;
    }

    async function refreshAuthState() {
      const { data } = await db.auth.getSession();
      authUser = data?.session?.user || null;
      if (authUser) {
        try { await ensureCurrentProfile(); await loadSavedStickers(); await loadUserSettings(); } catch (e) { console.warn('profile init', e); }
      } else {
        customStickers.clear();
        followingIds.clear();
        friendIds.clear();
        currentUser = {
          id: null, name: 'Гость', username: 'guest', avatar: avatars[8], followers: 0, following: 0, likes: 0,
          bio: 'Войдите, чтобы публиковать и взаимодействовать с видео', donationUsername:'', donationEnabled:false, donationConnected:false
        };
      }
      updateAuthUi();
      if (authUser) {
        startDonationSync();
      } else {
        stopDonationSync();
      }
      if (authUser) {
        if (document.getElementById('emailConfirmModal')?.classList.contains('visible')) closeModals();
        pendingConfirmationEmail = '';
      }
    }

    async function saveNewPassword() {
      const p1 = document.getElementById('newPassword').value;
      const p2 = document.getElementById('newPasswordRepeat').value;
      const err = document.getElementById('recoveryPasswordError');
      const btn = document.getElementById('passwordResetBtn');
      if (!recoveryVerified && !authUser) {
        err.textContent = 'Сначала подтвердите код из письма.';
        setPasswordRecoveryStep(2);
        return;
      }
      if (p1.length < 6) { err.textContent = 'Пароль должен содержать минимум 6 символов.'; return; }
      if (p1 !== p2) { err.textContent = 'Пароли не совпадают.'; return; }
      btn.disabled = true; btn.textContent = 'Сохраняем…'; err.textContent = '';
      try {
        const { error } = await db.auth.updateUser({ password: p1 });
        if (error) throw error;
        closeModals();
        recoveryEmail = '';
        recoveryVerified = false;
        showToast('Пароль изменён. Вы вошли в аккаунт.');
        await refreshAuthState();
        await loadRemoteData();
      } catch (error) {
        console.error('Password update error:', error);
        err.textContent = error?.message || 'Не удалось изменить пароль.';
      } finally {
        btn.disabled = false; btn.textContent = 'Сохранить новый пароль';
      }
    }

    async function signOut() {
      await db.auth.signOut();
      authUser = null;
      await refreshAuthState();
      await loadRemoteData();
      showScreen('feed');
      showToast('Вы вышли из аккаунта.');
    }

    function updateAuthUi() {
      const status = document.getElementById('dbStatus');
      if (status) {
        status.textContent = authUser ? `Supabase · ${currentUser.username}` : 'Supabase · публичный режим';
        status.classList.add('ok');
      }
    }

    function addCacheBust(url) {
      const clean = safeUrl(url);
      if (!clean) return '';
      try {
        const u = new URL(clean);
        u.searchParams.set('v', Date.now().toString());
        return u.href;
      } catch (_) {
        return clean;
      }
    }

    function updateAvatarEverywhere(user) {
      if (!user?.id) return;
      const id = String(user.id);
      const avatar = safeUrl(user.avatar) || fallbackAvatar(user.name);
      document.querySelectorAll('[data-userid]').forEach(node => {
        if (String(node.dataset.userid) !== id) return;
        node.querySelectorAll('img').forEach(img => { img.src = avatar; });
      });
      if (currentProfile && String(currentProfile.id) === id) {
        document.querySelectorAll('#profileHeader .profile-avatar img').forEach(img => { img.src = avatar; });
      }
      const preview = document.getElementById('profileEditAvatarPreview');
      if (preview && !profileEditSelectedFile) preview.src = avatar;
    }

    // ========== DATABASE ==========
    const CONTENT_FILTER_TERMS = ['18+','nsfw','porn','porno','xxx','explicit','эротик','порн','обнаж','секс','насилие','жесток','кровь','шок-контент'];
    function contentFilterBlocked(video){
      const level=Number(userSettings.content_filter_level||0);
      if(level<=0) return false;
      const text=normalizeModerationText(`${video?.title||''} ${video?.desc||''} ${video?.hashtags||''} ${video?.music||''}`);
      const terms=level===1?CONTENT_FILTER_TERMS.slice(0,8):CONTENT_FILTER_TERMS;
      return terms.some(term=>text.includes(normalizeModerationText(term)));
    }
    function videoAllowedBySettings(video){
      if(!video?.src || contentFilterBlocked(video)) return false;
      const hidden=(userSettings.hidden_words||[]).map(x=>normalizeModerationText(x)).filter(Boolean);
      if(!hidden.length) return true;
      const hay=normalizeModerationText(`${video.desc||''} ${video.hashtags||''} ${video.music||''} ${video.title||''}`);
      return !hidden.some(word=>hay.includes(word));
    }

    async function loadRemoteData(options = {}) {
      setDbStatus(options.force ? 'Обновление ленты…' : 'Загрузка данных…');
      try {
        const videoResult = await db.from('videos')
          .select('id,user_id,description,hashtags,tags,media_type,likes,views,comments_count,shares,likes_count,views_count,shares_count,created_at,sound,sound_name,title,status,visibility,is_published,duration_seconds,duration,video_url,image_url,media_url,thumbnail_url,username')
          .eq('status', 'published')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false })
          .limit(60);
        if (videoResult.error) throw videoResult.error;

        const rows = videoResult.data || [];
        const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))];
        if (userIds.length) {
          const profileResult = await db.from('profiles')
            .select('id,name,display_name,username,avatar_url,bio,followers_count,following_count,likes_count,videos_count,is_private,hide_likes,is_verified,donationalerts_username,donationalerts_enabled,donationalerts_connected')
            .in('id', userIds);
          if (profileResult.error) throw profileResult.error;
          (profileResult.data || []).forEach(p => {
            const u = userFromProfile(p);
            profileCache.set(u.id, u);
          });
        }

        users = [...profileCache.values()].filter(u => userIds.includes(u.id));
        if (!users.length) users = [...demoUsers];

        const mapped = rows.map(normalizeVideo).filter(videoAllowedBySettings);

        if (authUser) {
          const [subResult, likeResult, saveResult] = await Promise.all([
            db.from('subscriptions').select('following_id').eq('follower_id', authUser.id),
            db.from('likes').select('video_id').eq('user_id', authUser.id),
            db.from('saved_videos').select('video_id').eq('user_id', authUser.id)
          ]);
          if (subResult.error) throw subResult.error;
          if (likeResult.error) throw likeResult.error;
          if (saveResult.error) throw saveResult.error;
          followingIds.clear();
          (subResult.data || []).forEach(x => { if (x.following_id && x.following_id !== authUser.id) followingIds.add(x.following_id); });
          friendIds.clear();
          if (followingIds.size) {
            const { data: mutualRows, error: mutualError } = await db.from('subscriptions')
              .select('follower_id,following_id')
              .in('follower_id', [...followingIds])
              .eq('following_id', authUser.id);
            if (mutualError) throw mutualError;
            (mutualRows || []).forEach(x => { if (x.follower_id && followingIds.has(x.follower_id)) friendIds.add(x.follower_id); });
          }
          const liked = new Set((likeResult.data || []).map(x => x.video_id));
          const saved = new Set((saveResult.data || []).map(x => x.video_id));
          mapped.forEach(v => {
            v.subscribed = followingIds.has(v.authorId);
            v.isFriend = friendIds.has(v.authorId);
            v.liked = liked.has(v.id);
            v.favorited = saved.has(v.id);
            v.isMine = v.authorId === authUser.id;
          });
        }

        const visibleMapped = mapped.filter(v => {
          if (!v.author?.isPrivate) return true;
          if (authUser && String(v.authorId)===String(authUser.id)) return true;
          return Boolean(authUser && followingIds.has(v.authorId));
        });
        videos = visibleMapped;
        remoteLoaded = true;
        setDbStatus(authUser ? `Supabase · ${currentUser.username}` : 'Supabase · публичный режим', true);
        if (!videos.length) generateDemoVideos();
        renderFeed({ reshuffle: true });
        renderSearchSuggestions();
        if (currentProfile) renderProfileGrid('videos');
      } catch (error) {
        console.error('Supabase load error:', error);
        setDbStatus('Supabase · резервный режим');
        if (!videos.length) generateDemoVideos();
        renderFeed();
        showToast('База временно недоступна — включён резервный режим.');
      }
    }

    async function refreshVideo(id) {
      if (!isRemoteVideo(videos.find(v => v.id === id))) return;
      const { data, error } = await db.from('videos')
        .select('id,user_id,description,hashtags,tags,media_type,likes,views,comments_count,shares,likes_count,views_count,shares_count,created_at,sound,sound_name,title,status,visibility,is_published,duration_seconds,duration,video_url,image_url,media_url,thumbnail_url,username')
        .eq('id', id).maybeSingle();
      if (error || !data) return;
      const next = normalizeVideo(data);
      const existing = videos.find(v => v.id === id);
      if (existing) {
        next.liked = existing.liked;
        next.subscribed = existing.subscribed;
        next.favorited = existing.favorited;
        next.isMine = existing.isMine;
        next.subscribed = followingIds.has(next.authorId);
        next.isFriend = friendIds.has(next.authorId);
        Object.assign(existing, next);
      }
    }

