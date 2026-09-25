    // ========== PROFILE ==========
    async function openProfile(userId) {
      const key = String(userId ?? '');
      let user = key && profileCache.get(key);
      if (!user) user = users.find(u => String(u.id) === key);
      if (!user && authUser && key === String(authUser.id)) user = currentUser;
      if (!user) user = currentUser;

      // Всегда обновляем профиль перед показом шапки.
      // Это важно для likes_count: он меняется на сервере триггером после лайка,
      // а старый объект в profileCache мог сохранять 0.
      if (key) {
        try {
          const data = await fetchProfileById(key);
          if (data) {
            user = userFromProfile(data);
            profileCache.set(user.id, user);
            if (authUser && String(authUser.id) === String(user.id)) currentUser = user;
          }
        } catch (e) {
          console.warn('profile refresh', e);
        }
      }

      if (authUser && user.id && String(authUser.id) !== String(user.id)) {
        try {
          const { data: subRow, error: subError } = await db.from('subscriptions').select('follower_id').eq('follower_id', authUser.id).eq('following_id', user.id).maybeSingle();
          user.__isFollowing = !subError && Boolean(subRow);
          user.__followRequested = false;
          if(!user.__isFollowing && user.isPrivate){
            const {data:req}=await db.from('follow_requests').select('id,status').eq('requester_id',authUser.id).eq('target_id',user.id).maybeSingle();
            user.__followRequested=req?.status==='pending';
          }
        } catch (_) { user.__isFollowing = false; user.__followRequested = false; }
      } else { user.__isFollowing = false; user.__followRequested = false; }
      currentProfile = user;
      showScreen('profile');
      const isMe = Boolean(authUser && user.id === authUser.id);
      const isGuestProfile = !authUser && !user.id;
      const header = document.getElementById('profileHeader');
      const followingCount = Number(user.following || 0);
      const followersCount = Number(user.followers || 0);
      const likesCount = Number(user.likes || 0);
      header.innerHTML = `
        <div class="profile-back" onclick="showScreen('feed')" aria-label="Назад">${icon('back',20)}</div>
        ${isMe ? `<button class="profile-settings-btn" id="profileSettingsBtn" type="button" aria-label="Настройки" title="Настройки">${icon('settings',20)}</button>` : ''}
        <div class="profile-top">
          <div class="profile-avatar"><img src="${escapeHtml(user.avatar)}" alt="" /></div>
        </div>
        <div class="profile-actions">
          ${isMe
            ? `<button class="btn-secondary" id="profileAuthAction">Редактировать профиль</button>`
            : isGuestProfile
              ? `<button class="btn-primary" id="profileAuthAction">Войти</button>`
              : (() => { const following = Boolean(user.__isFollowing), requested=Boolean(user.__followRequested); return `<button class="${following || requested ? 'btn-secondary' : 'btn-primary'}" id="profileFollowBtn">${following ? 'Подписан' : requested ? `${icon('clock',14)} Запрос отправлен` : 'Подписаться'}</button>${following ? `<button class="btn-secondary" id="profileMessageBtn">${icon('message',16)} Написать</button>` : ''}`; })()
          + (user.donationEnabled && user.donationUsername && !isGuestProfile ? `<button class="btn-secondary" id="profileDonateBtn">${icon('donate',16)} Поддержать</button>` : '')
          }
        </div>
        <div class="profile-name">${escapeHtml(user.name)}</div>
        <div class="profile-username">@${escapeHtml(user.username)}</div>
        <div class="profile-stats">
          <button class="stat profile-stat-button" type="button" data-profile-connection="followers"><div class="num">${formatCount(followersCount)}</div><div class="label">Подписчики</div></button>
          <button class="stat profile-stat-button" type="button" data-profile-connection="following"><div class="num">${formatCount(followingCount)}</div><div class="label">Подписки</div></button>
          <div class="stat"><div class="num">${user.hideLikes ? '—' : formatCount(likesCount)}</div><div class="label">Лайки</div></div>
        </div>
        ${user.bio ? `<div class="profile-bio">${escapeHtml(user.bio)}</div>` : ''}
        <div style="height:2px"></div>`;
      hydrateIcons(header);
      document.getElementById('profileSettingsBtn')?.addEventListener('click', openSettings);
      const requestTab=document.querySelector('[data-connection-tab="requests"]'); if(requestTab) requestTab.style.display=isMe?'block':'none';
      header.querySelectorAll('[data-profile-connection]').forEach(btn=>btn.addEventListener('click',()=>openProfileConnections(btn.dataset.profileConnection)));

      const authAction = document.getElementById('profileAuthAction');
      if (authAction) authAction.onclick = () => isMe ? openProfileEditor() : openAuthModal();
      const profileDonateBtn = document.getElementById('profileDonateBtn');
      if (profileDonateBtn) profileDonateBtn.onclick = () => openDonationForAuthor(user);
      const profileMessageBtn = document.getElementById('profileMessageBtn');
      if (profileMessageBtn) profileMessageBtn.onclick = () => openDirectChat(user.id);

      const followBtn = document.getElementById('profileFollowBtn');
      if (followBtn) followBtn.onclick = async () => {
        const targetVideo = videos.find(v => String(v.authorId || v.author.id) === String(user.id));
        if (targetVideo) {
          await toggleSubscribe(targetVideo.id);
          user.__isFollowing = Boolean(targetVideo.subscribed);
          user.__followRequested = Boolean(targetVideo.followRequested);
        } else {
          try {
            const result = await db.from('subscriptions').select('follower_id').eq('follower_id',authUser.id).eq('following_id',user.id).maybeSingle();
            const isFollowing = Boolean(result.data);
            if(isFollowing) {
              await db.from('subscriptions').delete().eq('follower_id',authUser.id).eq('following_id',user.id);
              user.__isFollowing=false;
              user.__followRequested=false;
            } else if(user.isPrivate) {
              const {data:req,error:reqError}=await db.from('follow_requests').select('id,status').eq('requester_id',authUser.id).eq('target_id',user.id).maybeSingle();
              if(reqError) throw reqError;
              if(req?.status==='pending'){ user.__followRequested=true; showToast('Запрос на подписку уже отправлен.'); }
              else {
                const ins=await db.from('follow_requests').upsert({requester_id:authUser.id,target_id:user.id,status:'pending',updated_at:new Date().toISOString()},{onConflict:'requester_id,target_id'});
                if(ins.error) throw ins.error;
                user.__followRequested=true;
                showToast('Запрос на подписку отправлен.');
              }
            } else {
              const ins=await db.from('subscriptions').insert({follower_id:authUser.id,following_id:user.id});
              if(ins.error && ins.error.code!=='23505') throw ins.error;
              user.__isFollowing=true;
              user.__followRequested=false;
            }
          } catch(e) { console.error(e); showToast('Не удалось изменить подписку.'); return; }
        }
        openProfile(user.id);
      };

      document.querySelectorAll('.profile-tabs .ptab').forEach(t => {
        t.classList.toggle('active', t.dataset.ptab === 'videos');
        t.onclick = () => {
          document.querySelectorAll('.profile-tabs .ptab').forEach(x => x.classList.remove('active'));
          t.classList.add('active');
          renderProfileGrid(t.dataset.ptab);
        };
      });
      const canViewPrivate = isMe || !user.isPrivate || Boolean(user.__isFollowing);
      if(!canViewPrivate){
        const grid=document.getElementById('profileGrid');
        if(grid){ grid.innerHTML=`<div class="empty-state private-profile-empty" style="grid-column:1/-1"><div class="icon">${icon('lock',48)}</div><div style="font-size:16px;font-weight:800">Приватный аккаунт</div><div style="opacity:.65;font-size:13px;margin-top:6px">Подпишитесь на пользователя, чтобы смотреть его видео.</div></div>`; }
      } else {
        renderProfileGrid('videos');
      }
    }

    function shuffleArray(list) {
      const arr = [...list];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function openVideoFromProfile(videoId) {
      const id = String(videoId || '');
      if (!id) return;
      const target = videos.find(v => String(v.id) === id);
      if (!target) {
        showToast('Видео недоступно.');
        return;
      }

      currentFeedTab = 'foryou';
      document.querySelectorAll('[data-feed-tab]').forEach(t => t.classList.toggle('active', t.dataset.feedTab === 'foryou'));
      renderFeed();
      showScreen('feed');

      requestAnimationFrame(() => {
        const card = document.querySelector(`.video-card[data-id="${CSS.escape(id)}"]`);
        if (!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const media = card.querySelector('video');
        if (media) setTimeout(() => media.play().catch(() => {}), 180);
      });
    }

    async function renderProfileGrid(tab) {
      const grid = document.getElementById('profileGrid');
      let list = [];
      if (tab === 'videos') {
        list = videos.filter(v => String(v.authorId || v.author.id) === String(currentProfile?.id));
      } else if (tab === 'likes') {
        list = videos.filter(v => v.liked);
      } else {
        if (authUser && currentProfile?.id === authUser.id) {
          const { data } = await db.from('saved_videos').select('video_id').eq('user_id', authUser.id).limit(36);
          const ids = new Set((data || []).map(x => x.video_id));
          list = videos.filter(v => ids.has(v.id));
        }
      }

      if (!list.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">${icon(tab === 'likes' ? 'heart' : tab === 'favorites' ? 'bookmark' : 'play',48)}</div><div>Пока пусто</div></div>`;
        return;
      }
      grid.innerHTML = list.slice(0, 36).map(v => {
        const media = v.mediaType === 'image'
          ? `<img src="${escapeHtml(v.src)}" alt="" />`
          : (v.thumbnail
              ? `<img src="${escapeHtml(v.thumbnail)}" alt="" />`
              : `<div style="width:100%;height:100%;background:#111;"></div>`);
        return `<button class="thumb" type="button" data-video-id="${escapeHtml(v.id)}" aria-label="Открыть видео">${media}<div class="views">${icon('play',12)} ${formatCount(v.views || 0)}</div></button>`;
      }).join('');
      hydrateIcons(grid);
      grid.querySelectorAll('[data-video-id]').forEach(thumb => {
        thumb.addEventListener('click', () => openVideoFromProfile(thumb.dataset.videoId));
        thumb.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openVideoFromProfile(thumb.dataset.videoId);
          }
        });
      });
    }


    function profileEditDeadline(lastEditedAt) {
      if (!lastEditedAt) return null;
      const ts = new Date(lastEditedAt).getTime();
      if (!Number.isFinite(ts)) return null;
      return ts + 7 * 24 * 60 * 60 * 1000;
    }

    function formatProfileEditCooldown(deadline) {
      const ms = Math.max(0, Number(deadline || 0) - Date.now());
      const totalMinutes = Math.ceil(ms / 60000);
      if (totalMinutes >= 24 * 60) {
        const days = Math.floor(totalMinutes / (24 * 60));
        const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
        return hours ? `${days} дн. ${hours} ч.` : `${days} дн.`;
      }
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      if (hours) return `${hours} ч. ${minutes} мин.`;
      return `${Math.max(1, minutes)} мин.`;
    }

    function updateProfileBioCounter() {
      const bio = document.getElementById('profileEditBio');
      const counter = document.getElementById('profileEditBioCounter');
      if (bio && counter) counter.textContent = `${bio.value.length}/160`;
    }

    function resetProfileEditDraft() {
      if (profileEditObjectUrl) {
        URL.revokeObjectURL(profileEditObjectUrl);
        profileEditObjectUrl = '';
      }
      profileEditSelectedFile = null;
    }

    function updateProfileEditLock(canEdit, deadline = null) {
      const fields = ['profileEditAvatarBtn','profileEditName','profileEditUsername','profileEditBio','profileEditAvatarInput'];
      fields.forEach(id => { const el = document.getElementById(id); if (el) el.disabled = !canEdit; });
      const save = document.getElementById('profileEditSave');
      if (save) save.disabled = !canEdit || profileEditBusy;
      const cooldown = document.getElementById('profileEditCooldown');
      const cooldownText = document.getElementById('profileEditCooldownText');
      if (cooldown) cooldown.classList.toggle('visible', !canEdit);
      if (cooldownText && !canEdit && deadline) {
        const date = new Date(deadline);
        cooldownText.innerHTML = `Сейчас профиль редактировать нельзя. Следующее изменение доступно примерно через <b>${escapeHtml(formatProfileEditCooldown(deadline))}</b>, <span>${escapeHtml(date.toLocaleString('ru-RU', { dateStyle:'medium', timeStyle:'short' }))}</span>.`;
      }
    }

    async function openProfileEditor() {
      const user = await requireAuth('редактировать профиль');
      if (!user) return;
      resetProfileEditDraft();
      profileEditOriginal = null;
      const errorEl = document.getElementById('profileEditError');
      if (errorEl) errorEl.textContent = '';
      try {
        const data = await fetchProfileById(user.id);
        if (!data) throw new Error('Профиль не найден');
        profileEditOriginal = data;
        profileEditAvatarUrl = safeUrl(data.avatar_url) || fallbackAvatar(data.display_name || data.name);
        document.getElementById('profileEditName').value = data.display_name || data.name || '';
        document.getElementById('profileEditUsername').value = data.username || '';
        document.getElementById('profileEditBio').value = data.bio || '';
        updateProfileBioCounter();
        document.getElementById('profileEditAvatarPreview').src = profileEditAvatarUrl;
        const deadline = profileEditDeadline(data.profile_edit_last_at);
        const canEdit = !deadline || Date.now() >= deadline;
        updateProfileEditLock(canEdit, deadline);
        const modal = document.getElementById('profileEditModal');
        modal.classList.add('visible');
        hydrateIcons(modal);
      } catch (error) {
        console.error('Profile editor load error:', error);
        showToast('Не удалось открыть редактирование профиля.');
      }
    }

    function previewProfileEditAvatar(file) {
      if (!file) return;
      if (!file.type.startsWith('image/')) { showToast('Выберите изображение.'); return; }
      if (file.size > 5 * 1024 * 1024) { showToast('Аватар должен быть не больше 5 МБ.'); return; }
      if (profileEditObjectUrl) URL.revokeObjectURL(profileEditObjectUrl);
      profileEditObjectUrl = URL.createObjectURL(file);
      profileEditSelectedFile = file;
      document.getElementById('profileEditAvatarPreview').src = profileEditObjectUrl;
    }

    async function saveProfileEdits() {
      if (profileEditBusy || !profileEditOriginal || !authUser) return;
      const errorEl = document.getElementById('profileEditError');
      const name = document.getElementById('profileEditName').value.trim();
      const username = document.getElementById('profileEditUsername').value.trim();
      const bio = document.getElementById('profileEditBio').value.trim().slice(0, 160);
      if (errorEl) errorEl.textContent = '';
      if (name.length < 2 || name.length > 80) { if (errorEl) errorEl.textContent = 'Ник должен быть от 2 до 80 символов.'; return; }
      if (!/^[a-zA-Z0-9_]+$/.test(username) || username.length < 3 || username.length > 30) { if (errorEl) errorEl.textContent = 'Username: 3–30 символов, только a-z, 0-9 и _. '; return; }

      const oldName = profileEditOriginal.display_name || profileEditOriginal.name || '';
      const oldUsername = profileEditOriginal.username || '';
      const oldBio = profileEditOriginal.bio || '';
      const oldAvatar = safeUrl(profileEditOriginal.avatar_url) || fallbackAvatar(oldName);
      const changed = name !== oldName || username !== oldUsername || bio !== oldBio || Boolean(profileEditSelectedFile) || (profileEditAvatarUrl && profileEditAvatarUrl !== oldAvatar && profileEditAvatarUrl !== profileEditObjectUrl);
      if (!changed) { closeModals(); return; }

      profileEditBusy = true;
      const saveBtn = document.getElementById('profileEditSave');
      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Сохраняем…'; }
      try {
        let newAvatarUrl = safeUrl(profileEditOriginal.avatar_url) || null;
        if (profileEditSelectedFile) {
          const ext = (profileEditSelectedFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
          const path = `${authUser.id}/avatars/${crypto.randomUUID()}.${ext}`;
          const upload = await db.storage.from(STORAGE_BUCKET).upload(path, profileEditSelectedFile, {
            contentType: profileEditSelectedFile.type,
            upsert: false,
            cacheControl: '31536000'
          });
          if (upload.error) throw upload.error;
          newAvatarUrl = addCacheBust(db.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl);
        }

        const updates = { name, display_name: name, username, bio, avatar_url: newAvatarUrl, updated_at: new Date().toISOString() };
        const result = await db.from('profiles').update(updates).eq('id', authUser.id).select('*').single();
        if (result.error) throw result.error;

        const updated = result.data;
        const u = userFromProfile(updated);
        profileCache.set(u.id, u);
        currentUser = u;
        videos.forEach(v => { if (String(v.authorId || v.author?.id) === String(u.id)) v.author = u; });
        if (currentProfile && String(currentProfile.id) === String(u.id)) currentProfile = u;
        updateAvatarEverywhere(u);
        resetProfileEditDraft();
        closeModals();
        openProfile(u.id);
        renderFeed({ reshuffle: false });
        showScreen('profile');
        showToast('Профиль обновлён. Аватар сразу обновлён во всех местах.');
      } catch (error) {
        console.error('Profile edit save error:', error);
        const message = String(error?.message || '');
        if (message.includes('PROFILE_EDIT_COOLDOWN')) {
          try {
            const { data } = await db.from('profiles').select('profile_edit_last_at').eq('id', authUser.id).single();
            const deadline = profileEditDeadline(data?.profile_edit_last_at);
            updateProfileEditLock(false, deadline);
            if (errorEl) errorEl.textContent = 'Лимит на редактирование ещё не истёк.';
          } catch (_) {
            if (errorEl) errorEl.textContent = 'Лимит на редактирование ещё не истёк.';
          }
        } else if (error?.code === '23505') {
          if (errorEl) errorEl.textContent = 'Этот username уже занят.';
        } else {
          const msg = error?.message || 'Не удалось сохранить профиль.';
          if (/storage|bucket|object|upload|permission|public/i.test(msg)) {
            if (errorEl) errorEl.textContent = `Не удалось загрузить аватар: ${msg}`;
          } else {
            if (errorEl) errorEl.textContent = msg;
          }
        }
      } finally {
        profileEditBusy = false;
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Сохранить'; }
        const deadline = profileEditDeadline(profileEditOriginal?.profile_edit_last_at);
        if (deadline && Date.now() < deadline) updateProfileEditLock(false, deadline);
      }
    }


    // ========== PROFILE CONNECTIONS ==========
    async function openProfileConnections(mode='followers') {
      if (!currentProfile?.id) { showToast('Профиль недоступен.'); return; }
      const modal=document.getElementById('connectionsModal'); const list=document.getElementById('connectionsList');
      modal.classList.add('visible');
      document.querySelectorAll('[data-connection-tab]').forEach(b=>b.classList.toggle('active',b.dataset.connectionTab===mode));
      document.getElementById('connectionsTitle').textContent=mode==='followers'?'Подписчики':mode==='requests'?'Заявки на подписку':'Подписки';
      list.innerHTML=`<div class="connection-empty">Загрузка…</div>`;
      try {
        if(mode==='requests') {
          if(!authUser || String(currentProfile.id)!==String(authUser.id)){ list.innerHTML='<div class="connection-empty">Заявки доступны только владельцу аккаунта.</div>'; return; }
          const {data:requests,error}=await db.from('follow_requests').select('id,requester_id,created_at').eq('target_id',authUser.id).eq('status','pending').order('created_at',{ascending:false}).limit(300);
          if(error) throw error;
          const ids=(requests||[]).map(x=>x.requester_id).filter(Boolean);
          if(!ids.length){ list.innerHTML='<div class="connection-empty">Новых заявок нет.</div>'; return; }
          const {data:profiles,error:pe}=await db.from('profiles').select('id,name,display_name,username,avatar_url,followers_count').in('id',ids);
          if(pe) throw pe;
          const byId=new Map((profiles||[]).map(p=>[String(p.id),userFromProfile(p)]));
          list.innerHTML=(requests||[]).map(r=>{ const u=byId.get(String(r.requester_id)); if(!u)return ''; return `<div class="user-row request-row" data-connection-user="${escapeHtml(u.id)}"><div class="u-avatar"><img src="${escapeHtml(u.avatar)}" alt=""></div><div class="u-info"><div class="u-name">${escapeHtml(u.name)}</div><div class="u-username">@${escapeHtml(u.username)}</div></div><div style="display:flex;gap:6px"><button class="u-btn" data-request-accept="${escapeHtml(r.id)}" data-request-user="${escapeHtml(u.id)}">Принять</button><button class="u-btn" data-request-reject="${escapeHtml(r.id)}">Отклонить</button></div></div>`; }).join('');
          list.querySelectorAll('[data-request-accept]').forEach(btn=>btn.addEventListener('click',async e=>{ e.stopPropagation(); const rid=btn.dataset.requestAccept; try{ const result=await db.rpc('accept_follow_request',{p_request_id:rid}); if(result.error)throw result.error; showToast('Заявка принята.'); openProfileConnections('requests'); }catch(err){ console.error(err); showToast('Не удалось принять заявку. Выполните обновлённый settings_migration.sql.'); } }));
          list.querySelectorAll('[data-request-reject]').forEach(btn=>btn.addEventListener('click',async e=>{ e.stopPropagation(); try{ const up=await db.from('follow_requests').update({status:'rejected',updated_at:new Date().toISOString()}).eq('id',btn.dataset.requestReject).eq('target_id',authUser.id); if(up.error)throw up.error; showToast('Заявка отклонена.'); openProfileConnections('requests'); }catch(err){ console.error(err); showToast('Не удалось отклонить заявку.'); } }));
          return;
        }
        const field=mode==='followers'?'following_id':'follower_id';
        const target=mode==='followers'?'follower_id':'following_id';
        const {data,error}=await db.from('subscriptions').select('follower_id,following_id,created_at').eq(field,currentProfile.id).order('created_at',{ascending:false}).limit(300);
        if(error) throw error;
        const ids=[...new Set((data||[]).map(x=>x[target]).filter(Boolean))].filter(id=>String(id)!==String(currentProfile.id));
        if(!ids.length){list.innerHTML='<div class="connection-empty">Пока здесь никого нет.</div>';return;}
        const {data:profiles,error:pe}=await db.from('profiles').select('id,name,display_name,username,avatar_url,followers_count').in('id',ids);
        if(pe) throw pe;
        (profiles||[]).forEach(p=>profileCache.set(p.id,userFromProfile(p)));
        list.innerHTML=(profiles||[]).map(u=>{
          const targetVideo=videos.find(v=>String(v.authorId||v.author?.id)===String(u.id));
          const isMe=authUser && String(u.id)===String(authUser.id);
          return `<div class="user-row" data-connection-user="${escapeHtml(u.id)}"><div class="u-avatar"><img src="${escapeHtml(u.avatar)}" alt=""></div><div class="u-info"><div class="u-name">${escapeHtml(u.name)}</div><div class="u-username">@${escapeHtml(u.username)} · ${formatCount(u.followers)} подп.</div></div>${!isMe && authUser ? `<button class="u-btn ${targetVideo?.subscribed?'following':''}" data-connection-follow="${escapeHtml(u.id)}">${targetVideo?.subscribed?'Подписан':'Подписаться'}</button>`:''}</div>`;
        }).join('');
        list.querySelectorAll('[data-connection-user]').forEach(row=>row.addEventListener('click',e=>{ if(e.target.closest('button'))return; closeModals(); openProfile(row.dataset.connectionUser); }));
        list.querySelectorAll('[data-connection-follow]').forEach(btn=>btn.addEventListener('click',async e=>{ e.stopPropagation(); const id=btn.dataset.connectionFollow; const targetVideo=videos.find(v=>String(v.authorId||v.author?.id)===String(id)); if(targetVideo){ await toggleSubscribe(targetVideo.id); btn.textContent=targetVideo.subscribed?'Подписан':'Подписаться'; btn.classList.toggle('following',targetVideo.subscribed);} }));
      } catch(e) { console.error(e); list.innerHTML='<div class="connection-empty">Не удалось загрузить список.</div>'; }
    }

    function setupConnections() {
      document.querySelectorAll('[data-connection-tab]').forEach(btn=>btn.addEventListener('click',()=>openProfileConnections(btn.dataset.connectionTab)));
      document.getElementById('connectionsModal')?.addEventListener('click',e=>{ if(e.target.id==='connectionsModal') closeModals(); });
    }

    // ========== SETTINGS ==========
    const SETTINGS_TABS = [
      ['account','Аккаунт','user'],['privacy','Конфиденциальность','eye'],['notifications','Уведомления','message'],
      ['playback','Видео и лента','play'],['appearance','Внешний вид','settings'],['accessibility','Доступность','users'],
      ['content','Контент','flag'],['data','Данные и трафик','refresh'],['donations','Донаты','donate'],['security','Безопасность','lock'],['safety','Правила и помощь','shield']
    ];
    const DEFAULT_SETTINGS = {
      theme:'dark',language:'ru',autoplay:true,data_saver:false,video_quality:'auto',private_account:false,
      who_can_comment:'all',who_can_message:'all',who_can_duet:'all',hide_likes:false,allow_downloads:true,
      push_enabled:false,notify_likes:true,notify_comments:true,notify_follows:true,notify_mentions:true,
      notify_reposts:true,notify_messages:true,notify_donations:true,email_notifications:true,dnd_from:'',dnd_to:'',content_filter_level:0,
      screen_time_limit:0,break_reminder:false,hidden_words:[],
      comment_moderation_enabled:true,comment_moderation_level:2
    };
    let userSettings={...DEFAULT_SETTINGS};
    let currentSettingsTab='account';
    let screenTimeStartedAt = Date.now();
    let breakReminderTimer = null;

    function localSettingsKey(){ return `smotriuSettings:${authUser?.id || 'guest'}`; }
    function readLocalSettings(){
      try {
        const scoped=JSON.parse(localStorage.getItem(localSettingsKey())||'{}')||{};
        if(Object.keys(scoped).length) return scoped;
        return !authUser ? (JSON.parse(localStorage.getItem('smotriuSettings')||'{}')||{}) : {};
      } catch (_) { return {}; }
    }
    function cacheLocalSettings(){ try { localStorage.setItem(localSettingsKey(), JSON.stringify(userSettings)); } catch (_) {} }

    async function loadUserSettings(){
      const local=readLocalSettings();
      if(!authUser){ userSettings={...DEFAULT_SETTINGS,...local}; applyAllSettings(); return; }

      // Загружаем настройки и профиль независимо: старые схемы profiles могут не
      // содержать privacy-колонок, поэтому профиль берём через tolerant fetchProfileById().
      let settingsRow=null;
      try{
        const {data,error}=await db.from('user_settings').select('*').eq('user_id',authUser.id).maybeSingle();
        if(!error) settingsRow=data||null;
        else console.warn('user_settings load', error?.message || error);
      }catch(e){ console.warn('user_settings load',e); }

      let profileRow=null;
      try{ profileRow=await fetchProfileById(authUser.id); }
      catch(e){ console.warn('profile settings load',e); }

      const flat=settingsRow&&typeof settingsRow==='object'?settingsRow:{};
      const nested=flat.settings&&typeof flat.settings==='object'?flat.settings:{};
      const merged={...DEFAULT_SETTINGS,...local,...nested};
      Object.keys(DEFAULT_SETTINGS).forEach(k=>{ if(Object.prototype.hasOwnProperty.call(flat,k)) merged[k]=flat[k]; });
      if(profileRow){
        merged.private_account=Boolean(profileRow.is_private);
        merged.hide_likes=Boolean(profileRow.hide_likes);
        merged.who_can_comment=profileRow.who_can_comment||'all';
        merged.who_can_message=profileRow.who_can_message||'all';
        merged.who_can_duet=profileRow.who_can_duet||'all';
        merged.allow_downloads=profileRow.allow_downloads!==false;
      }
      userSettings=merged; cacheLocalSettings(); applyAllSettings();
    }

    function applyTheme(){
      const theme=userSettings.theme||'dark';
      const light=theme==='light'||(theme==='system'&&window.matchMedia?.('(prefers-color-scheme: light)').matches);
      document.body.classList.toggle('light-theme',!!light);
    }

    function applyLanguage(){
      const en=userSettings.language==='en';
      document.documentElement.lang = en ? 'en' : 'ru';
      const top = document.querySelectorAll('.top-nav .tab');
      if(top.length>=3){ top[0].textContent=en?'Following':'Подписки'; top[1].textContent=en?'For you':'Лента'; top[2].textContent=en?'Friends':'Друзья'; }
      const nav=document.querySelectorAll('.bottom-nav .btn');
      nav.forEach(btn=>{
        const screen=btn.dataset.screen, label=btn.querySelector('div:last-child');
        if(!label) return;
        const map={feed:en?'Feed':'Лента',search:en?'Search':'Поиск',inbox:en?'Inbox':'Входящие',profile:en?'Profile':'Профиль',settings:en?'Settings':'Настройки'};
        if(map[screen]) label.textContent=map[screen];
      });
      document.title='Смотрю';
    }

    function applyPlaybackSettings(){
      applyFeedSoundState();
      const container = document.getElementById('feedContainer');
      if(!container) return;
      container.querySelectorAll('.video-card video').forEach(v=>{
        v.autoplay = !!userSettings.autoplay;
        // Do not force `auto` on every card: the feed itself loads only nearby videos.
        v.preload = 'none';
        if(!userSettings.autoplay && !v.paused) v.pause();
      });
      if(userSettings.autoplay && currentScreenName === 'feed') playVisibleVideo();
    }

    function notificationSettingFor(type){
      const key=({like:'notify_likes',comment:'notify_comments',follow:'notify_follows',message:'notify_messages',mention:'notify_mentions',repost:'notify_reposts',donation:'notify_donations'})[type];
      return key ? userSettings[key]!==false : true;
    }
    function timeToMinutes(value){ const m=String(value||'').match(/^(\d{2}):(\d{2})$/); return m?Number(m[1])*60+Number(m[2]):null; }
    function isDndActive(){ const from=timeToMinutes(userSettings.dnd_from),to=timeToMinutes(userSettings.dnd_to); if(from===null||to===null||from===to)return false; const now=new Date(),m=now.getHours()*60+now.getMinutes(); return from<to?m>=from&&m<to:(m>=from||m<to); }
    function applyNotificationSettings(){ const b=document.querySelector('.bottom-nav .btn[data-screen=\"inbox\"]'); if(b&&isDndActive()) b.classList.remove('has-unread'); }
    function applyAllSettings(){ applyTheme(); applyLanguage(); applyPlaybackSettings(); applyNotificationSettings(); setupBreakReminder(); updateDownloadSettingsUI(); }

    async function requestPushPermission(){
      if(!('Notification' in window)){ showToast('Браузер не поддерживает push-уведомления.'); return false; }
      if(Notification.permission==='granted') return true;
      if(Notification.permission==='denied'){ showToast('Уведомления заблокированы в настройках браузера.'); return false; }
      const permission=await Notification.requestPermission();
      if(permission!=='granted') showToast('Разрешение на уведомления не выдано.');
      return permission==='granted';
    }

    async function saveUserSetting(key,value){
      if(!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS,key)){ showToast('Неизвестная настройка.'); return; }
      const previous=userSettings[key];
      if(key==='push_enabled'&&value) value=await requestPushPermission();
      if(key==='screen_time_limit') value=Math.max(0,Math.min(240,Number(value)||0));
      if(key==='comment_moderation_level') value=Math.max(1,Math.min(2,Number(value)||2));
      if(key==='content_filter_level') value=Math.max(0,Math.min(2,Number(value)||0));
      if(key==='dnd_from'||key==='dnd_to') value=/^\d{2}:\d{2}$/.test(String(value||''))?value:'';
      if(key==='hidden_words') value=Array.isArray(value)?value.map(x=>String(x).trim()).filter(Boolean).slice(0,100):[];
      userSettings[key]=value; cacheLocalSettings(); applyAllSettings();
      try{
        if(['content_filter_level','hidden_words'].includes(key)){ await loadRemoteData({force:true}); renderFeed({reshuffle:false}); }
        const privacyKeys=['private_account','hide_likes','who_can_comment','who_can_message','who_can_duet','allow_downloads'];
        if(privacyKeys.includes(key)) await syncPrivacyProfile(key,value);
        if(authUser){
          const {error}=await db.from('user_settings').upsert({user_id:authUser.id,[key]:value,updated_at:new Date().toISOString()},{onConflict:'user_id'});
          if(error) throw error;
        }
        if(authUser && privacyKeys.includes(key)){
          const fresh=await fetchProfileById(authUser.id);
          if(fresh){
            const u=userFromProfile(fresh);
            profileCache.set(u.id,u); currentUser=u;
            videos.forEach(v=>{ if(String(v.authorId||v.author?.id)===String(u.id)) v.author=u; });
            if(currentProfile && String(currentProfile.id)===String(u.id)) currentProfile=u;
          }
          renderFeed({reshuffle:false});
        }
        const note=document.getElementById('settingsSaveNote'); if(note){note.textContent='Сохранено';clearTimeout(note._t);note._t=setTimeout(()=>note.textContent='',1400);}
      }catch(e){
        console.error('setting save',e);
        // If the DB table is absent, keep the setting locally rather than pretending
        // that a successful click should revert immediately. The SQL migration in
        // settings_migration.sql enables persistent cross-device storage.
        if(['private_account','hide_likes','who_can_comment','who_can_message','who_can_duet','allow_downloads'].includes(key)){
          try{ await syncPrivacyProfile(key,userSettings[key]); showToast('Настройка применена. Для синхронизации на других устройствах выполните settings_migration.sql.'); return; }catch(_){ }
        }
        showToast('Настройка применена только на этом устройстве.');
      }
    }

    async function resetUserSettings(){
      userSettings={...DEFAULT_SETTINGS};
      cacheLocalSettings();
      applyAllSettings();
      if(authUser){
        try{
          const {error}=await db.from('user_settings').upsert({user_id:authUser.id,...DEFAULT_SETTINGS,updated_at:new Date().toISOString()},{onConflict:'user_id'});
          if(error) throw error;
          await Promise.all([
            syncPrivacyProfile('private_account',false),
            syncPrivacyProfile('hide_likes',false),
            syncPrivacyProfile('who_can_comment','all'),
            syncPrivacyProfile('who_can_message','all'),
            syncPrivacyProfile('who_can_duet','all'),
            syncPrivacyProfile('allow_downloads',true)
          ]);
        }catch(e){ console.warn('settings reset',e); showToast('Сброс выполнен локально.'); }
      }
      renderSettings();
      showToast('Настройки сброшены.');
    }

    async function syncPrivacyProfile(key,value){
      if(!authUser?.id) return;
      const cols={
        private_account:'is_private',hide_likes:'hide_likes',who_can_comment:'who_can_comment',
        who_can_message:'who_can_message',who_can_duet:'who_can_duet',allow_downloads:'allow_downloads'
      };
      const col=cols[key]; if(!col) return;
      const {error}=await db.from('profiles').update({[col]:value}).eq('id',authUser.id);
      if(error) throw error;
    }

    function settingControl(key,type='switch',options=[]){
      if(type==='none') return '';
      if(type==='switch') return `<label class="switch"><input type="checkbox" data-setting="${key}" ${userSettings[key]?'checked':''}><span class="switch-track"></span></label>`;
      if(type==='select') return `<select data-setting="${key}">${options.map(([v,l])=>`<option value="${escapeHtml(v)}" ${String(userSettings[key])===String(v)?'selected':''}>${escapeHtml(l)}</option>`).join('')}</select>`;
      if(type==='text') return `<input type="text" data-setting="${key}" value="${escapeHtml(userSettings[key]||'')}" />`;
      if(type==='number') return `<input type="number" min="0" max="240" data-setting="${key}" value="${Number(userSettings[key]||0)}" />`;
      if(type==='time') return `<input type="time" data-setting="${key}" value="${escapeHtml(userSettings[key]||'')}" />`;
      return '';
    }

    function settingRow(iconName,label,help,key,type='switch',options=[]){
      return `<div class="setting-row" ${key?'':''}><div class="setting-icon">${icon(iconName,18)}</div><div class="setting-main"><div class="setting-label">${label}</div><div class="setting-help">${help}</div></div><div class="setting-control">${settingControl(key,type,options)}</div></div>`;
    }

    function updateDownloadSettingsUI(){
      document.querySelectorAll('#feedContainer video').forEach(video=>video.controls=false);
    }

    function setupBreakReminder(){
      clearTimeout(breakReminderTimer);
      if(!userSettings.break_reminder || !(Number(userSettings.screen_time_limit)>0)) return;
      screenTimeStartedAt=Date.now();
      const minutes=Number(userSettings.screen_time_limit);
      breakReminderTimer=setTimeout(()=>{ if(document.visibilityState==='visible') showToast(`Вы уже ${minutes} мин. смотрите видео. Сделайте небольшой перерыв.`); setupBreakReminder(); }, minutes*60*1000);
    }

    function renderSettings(){
      const sidebar=document.getElementById('settingsSidebar'), content=document.getElementById('settingsContent'); if(!sidebar||!content)return;
      sidebar.innerHTML=SETTINGS_TABS.map(([id,label,ic])=>`<button class="settings-tab ${id===currentSettingsTab?'active':''}" type="button" data-settings-tab="${id}">${icon(ic,17)}<span>${label}</span></button>`).join('');
      hydrateIcons(sidebar);
      const titles={account:['Аккаунт','Управление профилем и входом.'],privacy:['Конфиденциальность','Кто видит контент и может взаимодействовать с вами.'],notifications:['Уведомления','Управляйте push и email-уведомлениями.'],playback:['Видео и лента','Настройки воспроизведения и экономии трафика.'],appearance:['Внешний вид','Тема и язык интерфейса.'],accessibility:['Доступность','Комфорт просмотра и напоминания.'],content:['Контент','Фильтры и скрытые слова.'],data:['Данные и трафик','Качество видео и использование сети.'],donations:['Донаты','DonationAlerts и золотой комментарий для поддержки авторов.'],security:['Безопасность','Параметры аккаунта и восстановление доступа.'],safety:['Правила и помощь','Правила сообщества, конфиденциальность и поддержка.']};
      let body='';
      if(currentSettingsTab==='account') body=`<div class="settings-card"><div class="settings-card-title">Профиль</div><div class="setting-row"><div class="setting-icon">${icon('user',18)}</div><div class="setting-main"><div class="setting-label">Имя и профиль</div><div class="setting-help">Измените имя, аватар и описание.</div></div><div class="setting-control"><button class="u-btn" id="settingsProfileBtn">Открыть</button></div></div></div><div class="settings-card"><div class="settings-card-title">Сессия</div><div class="setting-row"><div class="setting-icon">${icon('mail',18)}</div><div class="setting-main"><div class="setting-label">Email</div><div class="setting-help">${escapeHtml(authUser?.email||'Не выполнен вход')}</div></div><div class="setting-control"><button class="u-btn" id="settingsLogout">Выйти</button></div></div></div><div class="settings-card"><div class="settings-card-title">Сброс</div><div class="setting-row"><div class="setting-icon">${icon('refresh',18)}</div><div class="setting-main"><div class="setting-label">Сбросить все настройки</div><div class="setting-help">Вернуть стандартные значения.</div></div><div class="setting-control"><button class="u-btn" id="settingsReset">Сбросить</button></div></div></div>`;
      if(currentSettingsTab==='privacy') body=`<div class="settings-card"><div class="settings-card-title">Видимость</div>${settingRow('eye','Приватный аккаунт','Подписчики будут одобряться вручную.','private_account')}${settingRow('heart','Скрывать лайки','Скрывать количество лайков у ваших публикаций.','hide_likes')}${settingRow('download','Разрешать скачивание','Разрешить сохранение ваших видео на устройство.','allow_downloads')}</div><div class="settings-card"><div class="settings-card-title">Кто может</div>${settingRow('message','Комментировать','Выберите, кто может оставлять комментарии.','who_can_comment','select',[['all','Все'],['followers','Подписчики'],['none','Никто']])}${settingRow('message','Писать сообщения','Выберите, кто может отправлять вам сообщения.','who_can_message','select',[['all','Все'],['followers','Подписчики'],['none','Никто']])}${settingRow('users','Дуэты','Кто может создавать дуэты с вашими видео.','who_can_duet','select',[['all','Все'],['followers','Подписчики'],['none','Никто']])}</div>`;
      if(currentSettingsTab==='notifications') body=`<div class="settings-card"><div class="settings-card-title">Push</div>${settingRow('message','Push-уведомления','Показывать уведомления браузера, когда разрешение выдано.','push_enabled')}${settingRow('heart','Лайки','Когда кто-то лайкает ваши видео.','notify_likes')}${settingRow('message','Комментарии','Новые комментарии под вашими видео.','notify_comments')}${settingRow('userPlus','Новые подписчики','Когда на вас подписываются.','notify_follows')}${settingRow('message','Упоминания','Когда вас упоминают.','notify_mentions')}${settingRow('share','Репосты','Когда ваше видео репостят.','notify_reposts')}${settingRow('message','Сообщения','Новые личные сообщения.','notify_messages')}${settingRow('donate','Донаты','Новые донаты от ваших зрителей.','notify_donations')}${settingRow('mail','Email-уведомления','Важные письма на электронную почту.','email_notifications')}</div><div class="settings-card"><div class="settings-card-title">Не беспокоить</div><div class="settings-save-note" style="text-align:left;padding:8px 16px 12px">В указанное время новые push-уведомления не показываются.</div>${settingRow('settings','Начало','Время начала тишины.','dnd_from','time')}${settingRow('settings','Окончание','Время окончания тишины.','dnd_to','time')}</div>`;
      if(currentSettingsTab==='playback') body=`<div class="settings-card"><div class="settings-card-title">Воспроизведение</div>${settingRow('play','Автовоспроизведение','Запускать видео автоматически при появлении в ленте.','autoplay')}${settingRow('settings','Качество по умолчанию','Предпочтительное качество, если для видео доступна соответствующая версия.','video_quality','select',[['auto','Авто'],['360','360p'],['480','480p'],['720','720p'],['1080','1080p']])}${settingRow('refresh','Экономия трафика','Предзагрузка только метаданных видео.','data_saver')}</div>`;
      if(currentSettingsTab==='appearance') body=`<div class="settings-card"><div class="settings-card-title">Интерфейс</div>${settingRow('settings','Тема','Тёмная, светлая или системная тема.','theme','select',[['dark','Тёмная'],['light','Светлая'],['system','Системная']])}${settingRow('message','Язык','Язык основных элементов интерфейса.','language','select',[['ru','Русский'],['en','English']])}</div>`;
      if(currentSettingsTab==='accessibility') body=`<div class="settings-card"><div class="settings-card-title">Комфорт</div>${settingRow('settings','Напоминание сделать перерыв','Напоминать отдохнуть после заданного лимита.','break_reminder')}${settingRow('settings','Лимит экранного времени','0 — без ограничения, минут.','screen_time_limit','number')}</div>`;
      if(currentSettingsTab==='content') body=`<div class="settings-card"><div class="settings-card-title">Фильтры</div>${settingRow('flag','Фильтр контента','Уровень фильтра нежелательного контента.','content_filter_level','select',[['0','Минимальный'],['1','Средний'],['2','Строгий']])}<div class="setting-row"><div class="setting-icon">${icon('search',18)}</div><div class="setting-main"><div class="setting-label">Скрытые слова</div><div class="setting-help">Слова разделяйте запятыми.</div></div><div class="setting-control"><input type="text" id="hiddenWordsInput" value="${escapeHtml((userSettings.hidden_words||[]).join(', '))}" placeholder="слово, фраза"></div></div></div><div class="settings-card"><div class="settings-card-title">Модерация комментариев</div>${settingRow('shield','Фильтр комментариев','Быстрая проверка комментария до отправки. Нецензурная лексика блокируется сервером всегда; этот переключатель управляет дополнительной модерацией.','comment_moderation_enabled')}${settingRow('flag','Уровень защиты','Строгий режим дополнительно блокирует короткие токсичные реплики вроде «кринж» и «фу».','comment_moderation_level','select',[['1','Базовый'],['2','Строгий']])}<div class="moderation-note"><strong>Защита работает автоматически.</strong> Обходы с заменой символов и пробелами проверяются до сохранения комментария.</div></div>`;
      if(currentSettingsTab==='data') body=`<div class="settings-card"><div class="settings-card-title">Медиа</div>${settingRow('refresh','Экономия трафика','Более лёгкая загрузка видео и превью.','data_saver')}${settingRow('settings','Качество видео','Предпочтительное качество.','video_quality','select',[['auto','Авто'],['360','360p'],['480','480p'],['720','720p'],['1080','1080p']])}</div>`;
      if(currentSettingsTab==='donations') body=`<div class="settings-card"><div class="settings-card-title">DonationAlerts</div><div class="setting-row"><div class="setting-icon">${icon('donate',18)}</div><div class="setting-main"><div class="setting-label">Username для страницы доната</div><div class="setting-help">Укажите username из вашей ссылки DonationAlerts вида donationalerts.com/r/username.</div></div><div class="setting-control" style="display:flex;gap:8px;align-items:center"><input type="text" id="donationUsernameInput" value="${escapeHtml(currentUser?.donationUsername||'')}" maxlength="80" placeholder="username" /><button class="u-btn" id="saveDonationUsername" type="button">Сохранить</button></div></div><div class="setting-row"><div class="setting-icon">${icon('users',18)}</div><div class="setting-main"><div class="setting-label">Кнопка «Поддержать»</div><div class="setting-help">Показывать кнопку доната рядом с вашими видео и в профиле.</div></div><div class="setting-control"><label class="switch"><input type="checkbox" id="donationEnabledToggle" ${currentUser?.donationEnabled?'checked':''}><span class="switch-track"></span></label></div></div><div class="setting-row"><div class="setting-icon">${icon('link',18)}</div><div class="setting-main"><div class="setting-label">Подключение аккаунта</div><div class="setting-help">После подключения «Смотрю» автоматически импортирует новые донаты и превращает их в сообщения в комментариях.</div></div><div class="setting-control"><span class="donation-status ${currentUser?.donationConnected?'connected':'disconnected'}" id="donationStatus">${currentUser?.donationConnected?'Подключено':'Не подключено'}</span></div></div><div class="setting-row"><div class="setting-main"><div class="donation-settings-actions"><button class="u-btn" id="connectDonationBtn" type="button">${currentUser?.donationConnected?'Переподключить':'Подключить DonationAlerts'}</button>${currentUser?.donationConnected?'<button class="u-btn" id="disconnectDonationBtn" type="button">Отключить</button>':''}</div></div></div></div><div class="settings-card"><div class="settings-card-title">Золотой комментарий</div><div class="setting-row"><div class="setting-icon">${icon('donate',18)}</div><div class="setting-main"><div class="setting-label">Автоматическое закрепление</div><div class="setting-help">У автора один золотой комментарий — последнее сообщение от пользователя, который суммарно задонатил автору больше всех. Новый лидер автоматически заменяет прежний.</div></div><div class="setting-control"><span style="font-size:12px;color:#ffd76a;font-weight:800">RUB</span></div></div></div>`;
      if(currentSettingsTab==='safety') body=`<div class="settings-card"><div class="settings-card-title">Безопасность сообщества</div><div class="setting-row"><div class="setting-icon">${icon('shield',18)}</div><div class="setting-main"><div class="setting-label">Правила сообщества</div><div class="setting-help">Что нельзя публиковать и как работает модерация.</div></div><div class="setting-control"><button class="u-btn" id="openCommunityRulesBtn" type="button">Открыть</button></div></div><div class="setting-row"><div class="setting-icon">${icon('lock',18)}</div><div class="setting-main"><div class="setting-label">Политика конфиденциальности</div><div class="setting-help">Какие данные используются для работы функций приложения.</div></div><div class="setting-control"><button class="u-btn" id="openPrivacyPolicyBtn" type="button">Открыть</button></div></div></div><div class="settings-card"><div class="settings-card-title">Поддержка</div><div class="setting-row"><div class="setting-icon">${icon('message',18)}</div><div class="setting-main"><div class="setting-label">Страница поддержки</div><div class="setting-help">Сообщите о проблеме, нарушении или ошибке приложения.</div></div><div class="setting-control"><a class="u-btn" href="support.html">Открыть</a></div></div></div>`;
      if(currentSettingsTab==='security') body=`<div class="settings-card"><div class="settings-card-title">Безопасность</div><div class="setting-row"><div class="setting-icon">${icon('lock',18)}</div><div class="setting-main"><div class="setting-label">Пароль</div><div class="setting-help">Отправить письмо для восстановления доступа.</div></div><div class="setting-control"><button class="u-btn" id="settingsResetPassword">Сбросить</button></div></div><div class="setting-row"><div class="setting-icon">${icon('mail',18)}</div><div class="setting-main"><div class="setting-label">Подтверждение email</div><div class="setting-help">Управляется системой авторизации.</div></div><div class="setting-control"><span style="font-size:12px;color:#76e3a4;font-weight:700">Защищено</span></div></div></div>`;
      const [title,sub]=titles[currentSettingsTab];
      content.innerHTML=`<div class="settings-inner"><div class="settings-title">${title}</div><div class="settings-subtitle">${sub}</div><div class="settings-save-note" id="settingsSaveNote"></div>${body}</div>`;
      hydrateIcons(content);
      sidebar.querySelectorAll('[data-settings-tab]').forEach(b=>b.addEventListener('click',()=>{currentSettingsTab=b.dataset.settingsTab;renderSettings();}));
      content.querySelectorAll('[data-setting]').forEach(el=>el.addEventListener('change',async()=>{let value=el.type==='checkbox'?el.checked:el.value;if(el.dataset.setting==='content_filter_level'||el.dataset.setting==='screen_time_limit'||el.dataset.setting==='comment_moderation_level')value=Number(value||0);await saveUserSetting(el.dataset.setting,value);}));
      const hw=document.getElementById('hiddenWordsInput'); if(hw) hw.addEventListener('change',()=>saveUserSetting('hidden_words',hw.value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,100)));
      document.getElementById('settingsLogout')?.addEventListener('click',signOut);
      document.getElementById('settingsReset')?.addEventListener('click',resetUserSettings);
      document.getElementById('settingsProfileBtn')?.addEventListener('click',()=>openProfileEdit());
      document.getElementById('settingsResetPassword')?.addEventListener('click',async()=>{ if(authUser?.email) await sendPasswordReset(authUser.email); });
      document.getElementById('openCommunityRulesBtn')?.addEventListener('click',()=>window.location.href='community-rules.html');
      document.getElementById('openPrivacyPolicyBtn')?.addEventListener('click',()=>window.location.href='privacy.html');
      document.getElementById('saveDonationUsername')?.addEventListener('click',saveDonationProfileSettings);
      document.getElementById('donationEnabledToggle')?.addEventListener('change',saveDonationProfileSettings);
      document.getElementById('connectDonationBtn')?.addEventListener('click',connectDonationAlerts);
      document.getElementById('disconnectDonationBtn')?.addEventListener('click',disconnectDonationAlerts);
    }

    async function openSettings(){
      if(!authUser){openAuthModal('настройки');return;}
      await loadUserSettings(); currentSettingsTab='account'; showScreen('settings'); renderSettings();
    }
    function setupSettings(){ document.getElementById('settingsBack')?.addEventListener('click',()=>showScreen('profile')); }

    // ========== INBOX ==========
    function setupInbox() {
      document.querySelectorAll('.inbox-tabs .itab').forEach(t => {
        t.addEventListener('click', () => {
          document.querySelectorAll('.inbox-tabs .itab').forEach(x => x.classList.remove('active'));
          t.classList.add('active');
          renderInbox(t.dataset.itab);
        });
      });
    }

    async function renderInbox(tab) {
      tab = tab || document.querySelector('.inbox-tabs .itab.active')?.dataset.itab || 'notifs';
      const list = document.getElementById('inboxList');
      if (!authUser) {
        list.innerHTML = `<div class="empty-state"><div class="icon">${icon('mail',48)}</div><div>Войдите в аккаунт, чтобы видеть уведомления, активность и чаты.</div><button class="btn-primary" style="margin-top:14px;width:100%;" onclick="openAuthModal()">Войти</button></div>`;
        return;
      }
      try {
        if (tab === 'chats') {
          await renderChatList();
          return;
        }
        const { data, error } = await db.from('notifications').select('id,created_at,payload,is_read,video_id,text,comment_id,actor_id,type').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(80);
        if (error) throw error;
        const actorIds = [...new Set((data || []).map(n => n.actor_id).filter(Boolean))];
        if (actorIds.length) {
          const { data: actors } = await db.from('profiles').select('id,name,display_name,username,avatar_url').in('id', actorIds);
          (actors || []).forEach(p => profileCache.set(p.id, userFromProfile(p)));
        }
        const rows = tab === 'activity' ? (data || []).filter(n => ['like','comment','follow','donation'].includes(n.type)) : (data || []).filter(n => notificationSettingFor(n.type));
        if (!rows.length) {
          list.innerHTML = `<div class="empty-state"><div class="icon">${icon(tab === 'activity' ? 'refresh' : 'message',48)}</div><div>${tab === 'activity' ? 'Активности пока нет.' : 'Уведомлений пока нет.'}</div></div>`;
          return;
        }
        if (tab === 'activity') {
          list.innerHTML = rows.map(n => {
            const actor = n.actor_id && profileCache.get(n.actor_id);
            const text = n.type === 'donation' ? (n.text || 'Новый донат') : (n.text || ({like:'лайкнул ваше видео',comment:'прокомментировал ваше видео',follow:'подписался на вас'}[n.type] || 'новая активность'));
            const iconName = n.type === 'like' ? 'heartFill' : n.type === 'comment' ? 'message' : n.type === 'follow' ? 'userPlus' : 'donate';
            const label = n.type === 'donation' ? escapeHtml(text) : `<b>${escapeHtml(actor?.name || 'Пользователь')}</b> ${escapeHtml(text)}`;
            return `<div class="activity-item"><div class="activity-icon">${icon(iconName,18)}</div><div class="activity-main"><div class="activity-text">${label}</div><div class="activity-time">${formatRelativeTime(n.created_at)}${n.is_read ? '' : ' · новое'}</div></div></div>`;
          }).join('');
        } else {
          list.innerHTML = rows.map(n => {
            const actor = n.actor_id && profileCache.get(n.actor_id);
            const text = n.text || ({like:'лайкнул ваше видео',comment:'прокомментировал ваше видео',follow:'подписался на вас',message:'написал вам'}[n.type] || 'есть новое уведомление');
            const body = n.type === 'donation' ? escapeHtml(text) : `<b>${escapeHtml(actor?.name || 'Пользователь')}</b> ${escapeHtml(text)}`;
            const iconName = n.type === 'message' ? 'message' : n.type === 'like' ? 'heartFill' : n.type === 'comment' ? 'message' : n.type === 'follow' ? 'userPlus' : n.type === 'donation' ? 'donate' : 'refresh';
            return `<div class="notif-item" data-notification-id="${escapeHtml(n.id)}"><div class="avatar"><img src="${escapeHtml(actor?.avatar || fallbackAvatar(n.type === 'donation' ? '₽' : 'П'))}" /></div><div class="content"><div class="text"><span style="display:inline-flex;vertical-align:middle;margin-right:5px;opacity:.85">${icon(iconName,15)}</span>${body}</div><div class="time">${formatRelativeTime(n.created_at)}${n.is_read ? '' : ' · новое'}</div></div></div>`;
          }).join('');
        }
        const unreadIds = (data || []).filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length) {
          await db.from('notifications').update({ is_read:true, read_at:new Date().toISOString() }).eq('user_id',authUser.id).in('id',unreadIds);
        }
      } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="empty-state"><div class="icon">${icon('alert',48)}</div><div>Не удалось загрузить раздел.</div></div>`;
      }
    }

    async function renderChatList() {
      const list = document.getElementById('inboxList');
      const { data: memberships, error: memberError } = await db.from('conversation_members').select('conversation_id,unread_count,updated_at').eq('user_id',authUser.id).order('updated_at',{ascending:false}).limit(100);
      if (memberError) throw memberError;
      const ids = [...new Set((memberships || []).map(x => x.conversation_id).filter(Boolean))];
      if (!ids.length) {
        list.innerHTML = `<div class="empty-state"><div class="icon">${icon('message',48)}</div><div>Чаты пока пусты.</div><div style="margin-top:8px;font-size:12px;color:var(--text-muted)">Кнопка «Написать» появится в профиле автора после подписки.</div></div>`;
        return;
      }
      const [{data: conversations,error:convError},{data: members,error:allMemberError}] = await Promise.all([
        db.from('conversations').select('id,type,last_text,last_sender,last_kind,updated_at').in('id',ids).eq('type','private'),
        db.from('conversation_members').select('conversation_id,user_id').in('conversation_id',ids)
      ]);
      if (convError) throw convError;
      if (allMemberError) throw allMemberError;
      const otherIds = [...new Set((members || []).filter(m=>String(m.user_id)!==String(authUser.id)).map(m=>m.user_id).filter(Boolean))];
      if (otherIds.length) {
        const {data: profiles} = await db.from('profiles').select('id,name,display_name,username,avatar_url').in('id',otherIds);
        (profiles || []).forEach(p=>profileCache.set(p.id,userFromProfile(p)));
      }
      const ownUnread = new Map((memberships || []).map(m=>[m.conversation_id,Number(m.unread_count||0)]));
      const rows=(conversations||[]).filter(c=> (members||[]).filter(m=>m.conversation_id===c.id).length===2).map(c=>{
        const other=(members||[]).find(m=>m.conversation_id===c.id && String(m.user_id)!==String(authUser.id));
        return {c,other:other && profileCache.get(other.user_id),unread:ownUnread.get(c.id)||0};
      }).filter(x=>x.other);
      if(!rows.length){ list.innerHTML=`<div class="empty-state"><div class="icon">${icon('message',48)}</div><div>Чаты пока пусты.</div></div>`; return; }
      list.innerHTML=rows.map(({c,other,unread})=>`<div class="chat-list-item" data-open-chat="${escapeHtml(other.id)}"><div class="chat-list-avatar"><img src="${escapeHtml(other.avatar||fallbackAvatar(other.name))}" alt=""><span class="chat-unread" ${unread?'':'style="display:none"'}>${unread>99?'99+':unread}</span></div><div class="chat-list-main"><div class="chat-list-top"><div class="chat-list-name">${escapeHtml(other.name)}</div><div class="chat-list-time">${formatRelativeTime(c.updated_at)}</div></div><div class="chat-list-preview">${escapeHtml(c.last_text || 'Начните общение')}</div></div></div>`).join('');
      list.querySelectorAll('[data-open-chat]').forEach(el=>el.addEventListener('click',()=>openDirectChat(el.dataset.openChat)));
    }

    let activeChatId = null;
    let activeChatPartnerId = null;
    let activeChatChannel = null;

    async function openDirectChat(otherUserId) {
      const user = await requireAuth('написать автору');
      if (!user) return;
      if (!otherUserId || String(otherUserId)===String(user.id)) return;
      try {
        const {data: subRow,error: subError}=await db.from('subscriptions').select('follower_id').eq('follower_id',user.id).eq('following_id',otherUserId).maybeSingle();
        if(subError) throw subError;
        if(!subRow){ showToast('Сначала подпишитесь на автора.'); return; }
        const partnerRow=await fetchProfileById(otherUserId);
        if(!partnerRow) throw new Error('USER_NOT_FOUND');
        const partner=userFromProfile(partnerRow);
        const canMessage=partner.whoCanMessage==='none' ? false : partner.whoCanMessage==='followers' ? Boolean(subRow) : true;
        if(!canMessage){ showToast('Автор запретил личные сообщения.'); return; }
        const rpc=await db.rpc('get_or_create_direct_chat',{p_other_user:otherUserId});
        if(rpc.error) throw rpc.error;
        activeChatId=rpc.data; activeChatPartnerId=otherUserId;
        document.getElementById('chatHeadName').textContent=partner.name||'Пользователь';
        document.getElementById('chatHeadStatus').textContent=`@${partner.username||'user'}`;
        document.getElementById('chatHeadAvatar').src=partner.avatar||fallbackAvatar(partner.name||'П');
        document.getElementById('chatBody').innerHTML=`<div class="chat-empty"><div class="icon">${icon('message',38)}</div><div>Загрузка сообщений…</div></div>`;
        document.getElementById('chatModal').classList.add('visible');
        hydrateIcons(document.getElementById('chatModal'));
        await loadChatMessages();
        await markChatRead();
        if(activeChatChannel){ try{ await db.removeChannel(activeChatChannel); }catch(_){} }
        activeChatChannel=db.channel(`chat:${activeChatId}`);
        activeChatChannel.on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${activeChatId}`},async payload=>{
          if(!payload?.new) return;
          await renderChatMessagesFromDb(true);
          await markChatRead();
        }).subscribe();
      } catch(error){
        console.error('openDirectChat',error);
        const msg=String(error?.message||'');
        if(msg.includes('FOLLOW_REQUIRED')) showToast('Чтобы написать автору, подпишитесь на него.');
        else if(msg.includes('MESSAGES_DISABLED')) showToast('Автор запретил личные сообщения.');
        else showToast('Не удалось открыть чат.');
      }
    }

    async function loadChatMessages(){ return renderChatMessagesFromDb(false); }
    function extractSharedVideoIdFromChat(bodyText){
      const match=String(bodyText||'').match(/#video=([^\s]+)/i); if(!match)return '';
      try{return decodeURIComponent(match[1]);}catch(_){return match[1];}
    }
    function renderChatMessageBody(bodyText){
      const raw=String(bodyText||''), id=extractSharedVideoIdFromChat(raw), video=id?videos.find(v=>String(v.id)===String(id)):null;
      if(!video)return escapeHtml(raw);
      const thumb=video.thumbnail?`<img src="${escapeHtml(video.thumbnail)}" alt="">`:`<span class="chat-video-share-play">${icon('play',22)}</span>`;
      return `<button type="button" class="chat-video-share" data-chat-video-id="${escapeHtml(video.id)}"><span class="chat-video-share-thumb">${thumb}</span><span class="chat-video-share-info"><span class="chat-video-share-title">${escapeHtml(video.title||'Видео из «Смотрю»')}</span><span class="chat-video-share-desc">Нажмите, чтобы открыть видео</span></span><span class="chat-video-share-icon">${icon('play',16)}</span></button>`;
    }
    async function renderChatMessagesFromDb(smartScroll=false){
      if(!activeChatId)return;
      const {data,error}=await db.from('messages').select('id,sender_id,body,created_at,read_at').eq('conversation_id',activeChatId).order('created_at',{ascending:true}).limit(200); if(error)throw error;
      const body=document.getElementById('chatBody'); if(!data?.length){body.innerHTML=`<div class="chat-empty"><div class="icon">${icon('message',38)}</div><div>Начните диалог первым сообщением.</div></div>`;return;}
      body.innerHTML=data.map(m=>`<div class="chat-message ${String(m.sender_id)===String(authUser.id)?'mine':''}"><div class="chat-message-body">${renderChatMessageBody(m.body)}</div><div class="chat-message-meta"><span>${new Date(m.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</span>${String(m.sender_id)===String(authUser.id)&&m.read_at?'✓':''}</div></div>`).join('');
      body.querySelectorAll('[data-chat-video-id]').forEach(card=>card.addEventListener('click',async()=>{const id=card.dataset.chatVideoId;closeDirectChat();await openVideoById(id,{updateHash:true,scroll:true});}));
      hydrateIcons(body); if(smartScroll||body.scrollHeight-body.scrollTop-body.clientHeight<180)body.scrollTop=body.scrollHeight;
    }

    async function markChatRead(){
      if(!activeChatId || !authUser) return;
      const {data:last}=await db.from('messages').select('id').eq('conversation_id',activeChatId).order('created_at',{ascending:false}).limit(1).maybeSingle();
      if(last?.id) await db.from('conversation_members').update({unread_count:0,last_read_message_id:last.id,updated_at:new Date().toISOString()}).eq('conversation_id',activeChatId).eq('user_id',authUser.id);
      await db.from('notifications').update({is_read:true,read_at:new Date().toISOString()}).eq('user_id',authUser.id).eq('conversation_id',activeChatId).eq('type','message');
    }

    async function sendChatMessage(){
      if(!activeChatId) return;
      const input=document.getElementById('chatInput'); const btn=document.getElementById('chatSendBtn');
      const body=String(input.value||'').trim(); if(!body) return;
      btn.disabled=true;
      try{
        const {error}=await db.rpc('send_direct_message',{p_conversation_id:activeChatId,p_body:body});
        if(error) throw error;
        input.value=''; input.style.height='40px';
        await renderChatMessagesFromDb(true);
      }catch(error){
        console.error('sendChatMessage',error);
        const msg=String(error?.message||'');
        if(msg.includes('NOT_A_MEMBER')) showToast('Чат больше недоступен.');
        else if(msg.includes('EMPTY_MESSAGE')) showToast('Введите сообщение.');
        else showToast('Не удалось отправить сообщение.');
      }finally{btn.disabled=false;input.focus();}
    }

    function closeDirectChat(){
      document.getElementById('chatModal')?.classList.remove('visible');
      if(activeChatChannel){ try{ db.removeChannel(activeChatChannel); }catch(_){} activeChatChannel=null; }
      activeChatId=null; activeChatPartnerId=null;
    }

    function formatRelativeTime(value) {
      if (!value) return '';
      const diff = Math.max(0, Date.now() - new Date(value).getTime());
      const min = Math.floor(diff / 60000);
      if (min < 1) return 'сейчас';
      if (min < 60) return `${min} мин`;
      const h = Math.floor(min / 60);
      if (h < 24) return `${h} ч`;
      const d = Math.floor(h / 24);
      return d === 1 ? 'вчера' : `${d} дн`;
    }

    // ========== SEARCH ==========
    const SEARCH_SELF_HARM_TERMS = [
      'как умереть','быстро умереть','легко умереть','безболезненно умереть','как покончить с собой','как покончить собой','умереть без боли','умереть безболезненно',
      'хочу умереть','хочу покончить с собой','убить себя','убиться','суицид','самоубийство','самоубийца',
      'мысли о смерти','мысли о самоубийстве','не хочу жить','не хочу больше жить','навредить себе','причинить себе вред',
      'самоповреждение','селфхарм','self harm','self-harm','suicide','suicidal','kill myself','want to die'
    ];
    const SEARCH_ADULT_TERMS = [
      'порно','порнография','порнуха','эротика 18','эротический','секс','секс видео','голые','обнаженные','обнажённые',
      'нюд','nude','porn','pornography','xxx','nsfw','onlyfans','онлифанс','мастурбация','проститутка','проституция','бдсм','bdsm'
    ];

    function normalizeSearchSafety(value){
      return String(value||'').normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/giu,' ').replace(/\s+/g,' ').trim();
    }

    function searchContainsPhrase(q, terms){
      const text=normalizeSearchSafety(q);
      return terms.some(term=>{
        const t=normalizeSearchSafety(term);
        return t && text.includes(t);
      });
    }

    function renderSearchSafetyNotice(type, q){
      const results=document.getElementById('searchResults');
      if(!results) return true;
      if(type==='selfharm'){
        results.innerHTML=`<div class="search-safety-card search-safety-card--support" role="status"><div class="search-safety-icon">❤</div><div class="search-safety-title">Вы не одни</div><div class="search-safety-text">Похоже, этот запрос связан с сильной болью или мыслями о смерти. Не оставайтесь с этим в одиночку. Поговорите с близким человеком или специалистом.</div><a class="search-safety-action" href="tel:+74959895050">Позвонить в психологическую службу МЧС: +7 (495) 989-50-50</a><div class="search-safety-help">На официальном сайте МЧС есть круглосуточная психологическая помощь и возможность обратиться к психологу онлайн. <a href="https://psi.mchs.gov.ru/" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">Открыть службу помощи</a>. При непосредственной опасности звоните 112.</div></div>`;
        return true;
      }
      if(type==='adult'){
        results.innerHTML=`<div class="search-safety-card search-safety-card--adult" role="status"><div class="search-safety-icon">18+</div><div class="search-safety-title">Поиск ограничен</div><div class="search-safety-text">Этот запрос относится к сексуальному контенту 18+, поэтому такие результаты не показываются в поиске.</div><div class="search-safety-query">Запрос: «${safeQ}»</div></div>`;
        return true;
      }
      return false;
    }

    function setupSearch() {
      const input = document.getElementById('searchInput');
      if (!input || input.dataset.searchBound === '1') return;
      input.dataset.searchBound = '1';
      input.addEventListener('input', () => renderSearchResults(input.value.trim().toLowerCase()));
    }

    function renderSearchResults(q) {
      const results = document.getElementById('searchResults');
      if (!q) { renderSearchSuggestions(); return; }
      if(searchContainsPhrase(q, SEARCH_SELF_HARM_TERMS)){ renderSearchSafetyNotice('selfharm', q); return; }
      if(searchContainsPhrase(q, SEARCH_ADULT_TERMS)){ renderSearchSafetyNotice('adult', q); return; }
      const matchedUsers = users.filter(u => `${u.name} ${u.username}`.toLowerCase().includes(q));
      const matchedVideos = videos.filter(v => `${v.desc} ${v.hashtags} ${v.title}`.toLowerCase().includes(q));
      results.innerHTML = `
        <div class="search-section-title">Пользователи</div>
        ${matchedUsers.length ? matchedUsers.map(u => `<div class="user-row" onclick="openProfile('${escapeHtml(u.id)}')"><div class="u-avatar"><img src="${escapeHtml(u.avatar)}" /></div><div class="u-info"><div class="u-name">${escapeHtml(u.name)}</div><div class="u-username">@${escapeHtml(u.username)} · ${formatCount(u.followers)} подп.</div></div></div>`).join('') : `<div class="empty-state">Никого не найдено</div>`}
        <div class="search-section-title">Видео</div>
        ${matchedVideos.length ? `<div class="profile-grid">${matchedVideos.slice(0,12).map(v => `<div class="thumb" data-id="${escapeHtml(v.id)}">${v.mediaType === 'image' ? `<img src="${escapeHtml(v.src)}" />` : (v.thumbnail ? `<img src="${escapeHtml(v.thumbnail)}" />` : `<div style="width:100%;height:100%;background:#111;"></div>`)}</div>`).join('')}</div>` : `<div class="empty-state">Видео не найдены</div>`}`;
    }

    function renderSearchSuggestions() {
      let box = document.getElementById('searchSuggestions');
      if (!box) {
        const results = document.getElementById('searchResults');
        if (!results) return;
        box = document.createElement('div');
        box.id = 'searchSuggestions';
        results.appendChild(box);
      }
      const candidates = users.slice(0, 8);
      box.innerHTML = candidates.map(u => `
        <div class="user-row" onclick="openProfile('${escapeHtml(u.id)}')">
          <div class="u-avatar"><img src="${escapeHtml(u.avatar)}" /></div>
          <div class="u-info"><div class="u-name">${escapeHtml(u.name)}</div><div class="u-username">@${escapeHtml(u.username)}</div></div>
          <button class="u-btn" data-follow-user="${escapeHtml(u.id)}">Подписаться</button>
        </div>
      `).join('');
      box.querySelectorAll('[data-follow-user]').forEach(btn => {
        btn.addEventListener('click', async e => {
          e.stopPropagation();
          const target = videos.find(v => String(v.authorId || v.author.id) === String(btn.dataset.followUser));
          if (target) {
            await toggleSubscribe(target.id);
            btn.textContent = target.subscribed ? 'Подписан' : 'Подписаться';
            btn.classList.toggle('following', target.subscribed);
          } else {
            await requireAuth('подписаться на автора');
          }
        });
      });
    }

