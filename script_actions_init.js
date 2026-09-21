    // ========== RECORD / CREATE ==========
    function setupRecord() {
      document.getElementById('recordBtn').addEventListener('click', toggleRecord);
      document.getElementById('galleryBtn').addEventListener('click', () => document.getElementById('galleryInput').click());
      document.getElementById('galleryInput').addEventListener('change', handleGallery);
      document.getElementById('nextBtn').addEventListener('click', goToPublish);
      document.getElementById('flipBtn').addEventListener('click', switchCamera);
      document.getElementById('enableCameraBtn').addEventListener('click', startCamera);
      document.getElementById('enableCameraBottomBtn').addEventListener('click', startCamera);
      document.getElementById('zoomOutBtn').addEventListener('click', () => setCameraZoom(cameraZoom - cameraZoomStep));
      document.getElementById('zoomInBtn').addEventListener('click', () => setCameraZoom(cameraZoom + cameraZoomStep));
      document.getElementById('coverEditBtn').addEventListener('click', () => document.getElementById('coverInput').click());
      document.getElementById('coverInput').addEventListener('change', handleCoverChange);
      updateCameraControls();
    }

    function getActiveCameraTrack() {
      return mediaStream?.getVideoTracks?.()[0] || null;
    }

    function updateCameraControls() {
      const enabled = Boolean(mediaStream?.active);
      document.getElementById('enableCameraBtn')?.classList.toggle('hidden', enabled);
      const zoomOut = document.getElementById('zoomOutBtn');
      const zoomIn = document.getElementById('zoomInBtn');
      if (zoomOut) zoomOut.disabled = !enabled || cameraZoom <= cameraZoomMin + 0.001;
      if (zoomIn) zoomIn.disabled = !enabled || cameraZoom >= cameraZoomMax - 0.001;
      [zoomOut, zoomIn].forEach(btn => { if (btn) btn.style.opacity = btn.disabled ? '.45' : '1'; });
    }

    async function setCameraZoom(nextZoom) {
      const track = getActiveCameraTrack();
      if (!track) { showToast('Сначала включите камеру.'); return; }
      const target = Math.max(cameraZoomMin, Math.min(cameraZoomMax, Number(nextZoom.toFixed(2))));
      try {
        if (cameraHardwareZoom) {
          await track.applyConstraints({ advanced: [{ zoom: target }] });
          cameraZoom = target;
        } else {
          // Fallback for browsers that expose no hardware zoom. The preview still
          // gets a useful framing adjustment instead of failing the button action.
          cameraZoom = target;
          const video = document.getElementById('cameraPreview');
          const mirror = currentCameraFacingMode === 'user' ? ' scaleX(-1)' : '';
          video.style.transform = `scale(${cameraZoom})${mirror}`;
        }
      } catch (error) {
        console.warn('Camera zoom error:', error);
        showToast('Эта камера не поддерживает зум.');
      }
      updateCameraControls();
    }

    function readCameraZoomCapabilities(track) {
      const caps = track?.getCapabilities?.();
      const range = caps?.zoom;
      if (range && Number.isFinite(range.min) && Number.isFinite(range.max) && Number(range.max) > Number(range.min)) {
        cameraHardwareZoom = true;
        cameraZoomMin = Number(range.min);
        cameraZoomMax = Number(range.max);
        cameraZoomStep = Number(range.step) || 0.1;
        cameraZoom = Math.max(cameraZoomMin, Math.min(cameraZoomMax, cameraZoom));
      } else {
        cameraHardwareZoom = false;
        cameraZoomMin = 1;
        cameraZoomMax = 1.8;
        cameraZoomStep = 0.1;
        cameraZoom = 1;
      }
    }

    function resetCameraTransform() {
      const video = document.getElementById('cameraPreview');
      if (!video) return;
      video.style.transform = currentCameraFacingMode === 'user' ? 'scaleX(-1)' : '';
    }

    async function startCamera() {
      const video = document.getElementById('cameraPreview');
      const placeholder = document.getElementById('cameraPlaceholder');
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia unavailable');
        if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: currentCameraFacingMode },
            width: { ideal: 720, max: 1080 },
            height: { ideal: 1280, max: 1920 },
            aspectRatio: { ideal: 9 / 16 }
          },
          audio: true
        });
        video.srcObject = mediaStream;
        video.src = '';
        video.style.display = 'block';
        readCameraZoomCapabilities(getActiveCameraTrack());
        resetCameraTransform();
        placeholder.style.display = 'none';
        updateCameraControls();
        return true;
      } catch (err) {
        console.warn('Camera error:', err);
        video.style.display = 'none';
        placeholder.style.display = 'none';
        document.getElementById('enableCameraBtn')?.classList.remove('hidden');
        updateCameraControls();
        return false;
      }
    }

    async function switchCamera() {
      if (isRecording) {
        showToast('Сменить камеру во время записи нельзя.');
        return;
      }
      currentCameraFacingMode = currentCameraFacingMode === 'user' ? 'environment' : 'user';
      cameraZoom = 1;
      const ready = await startCamera();
      if (!ready) {
        currentCameraFacingMode = currentCameraFacingMode === 'user' ? 'environment' : 'user';
        await startCamera();
        showToast('Не удалось переключить камеру.');
      }
    }

    function stopCamera() {
      if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
      if (mediaRecorder && mediaRecorder.state !== 'inactive') { try { mediaRecorder.stop(); } catch (_) {} }
      isRecording = false;
      clearInterval(recordInterval);
      document.getElementById('recordBtn').classList.remove('recording');
      document.getElementById('recordTimer').classList.remove('visible');
      document.getElementById('nextBtn').classList.remove('visible');
      cameraZoom = 1; cameraZoomMin = 1; cameraZoomMax = 1; cameraZoomStep = 0.1; cameraHardwareZoom = false;
      updateCameraControls();
    }

    async function toggleRecord() {
      if (isRecording) {
        stopRecording();
        document.getElementById('recordBtn').setAttribute('aria-label','Начать запись');
        document.getElementById('recordBtn').setAttribute('title','Начать запись');
        return;
      }
      if (!mediaStream) {
        const ready = await startCamera();
        if (!ready || !mediaStream) {
          showToast('Не удалось открыть камеру. Разрешите доступ к камере и микрофону.');
          return;
        }
      }
      startRecording();
      document.getElementById('recordBtn').setAttribute('aria-label','Остановить запись');
      document.getElementById('recordBtn').setAttribute('title','Остановить запись');
    }

    function startRecording() {
      recordedChunks = [];
      try { mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm;codecs=vp8,opus' }); } catch (_) { mediaRecorder = new MediaRecorder(mediaStream); }
      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        pendingVideoBlob = new Blob(recordedChunks, { type: 'video/webm' });
        pendingVideoUrl = URL.createObjectURL(pendingVideoBlob);
        document.getElementById('nextBtn').classList.add('visible');
      };
      mediaRecorder.start(100);
      isRecording = true;
      document.getElementById('recordBtn').classList.add('recording');
      document.getElementById('recordTimer').classList.add('visible');
      recordStart = Date.now();
      recordInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - recordStart) / 1000);
        document.getElementById('recordTimer').textContent = `${String(Math.floor(sec / 60)).padStart(2,'0')}:${String(sec % 60).padStart(2,'0')}`;
        if (sec >= 60) stopRecording();
      }, 200);
    }

    function stopRecording() {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      isRecording = false;
      clearInterval(recordInterval);
      document.getElementById('recordBtn').classList.remove('recording');
      document.getElementById('recordBtn').setAttribute('aria-label','Начать запись');
      document.getElementById('recordBtn').setAttribute('title','Начать запись');
    }

    function handleGallery(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!/^((video|image)\/(mp4|webm|quicktime|jpeg|png|webp|gif))$/i.test(file.type) && !file.type.startsWith('video/') && !file.type.startsWith('image/')) {
        showToast('Этот формат не поддерживается.');
        return;
      }
      pendingVideoBlob = file;
      pendingVideoUrl = URL.createObjectURL(file);
      document.getElementById('nextBtn').classList.add('visible');
      const preview = document.getElementById('cameraPreview');
      if (file.type.startsWith('video/')) {
        preview.srcObject = null;
        preview.src = pendingVideoUrl;
        preview.style.display = 'block';
        document.getElementById('cameraPlaceholder').style.display = 'none';
        preview.play().catch(() => {});
      } else {
        preview.style.display = 'none';
      }
    }

    async function generateVideoThumbnail(videoUrl) {
      return new Promise(resolve => {
        const video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.src = videoUrl;

        const cleanup = () => {
          video.removeAttribute('src');
          video.load();
        };
        const fail = () => { cleanup(); resolve(null); };

        video.addEventListener('error', fail, { once: true });
        video.addEventListener('loadedmetadata', () => {
          if (!Number.isFinite(video.duration) || video.duration <= 0) { fail(); return; }
          const target = Math.min(Math.max(video.duration * 0.08, 0.05), 0.8);
          try {
            video.currentTime = target;
          } catch (_) {
            video.currentTime = 0;
          }
        }, { once: true });

        video.addEventListener('seeked', () => {
          try {
            const canvas = document.createElement('canvas');
            const width = Math.max(320, Math.min(video.videoWidth || 720, 900));
            const height = Math.max(180, Math.round(width * ((video.videoHeight || 1280) / (video.videoWidth || 720))));
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { alpha: false });
            if (!ctx) { fail(); return; }
            ctx.drawImage(video, 0, 0, width, height);
            canvas.toBlob(blob => {
              cleanup();
              resolve(blob || null);
            }, 'image/jpeg', 0.86);
          } catch (_) {
            fail();
          }
        }, { once: true });

        video.load();
      });
    }

    function handleCoverChange(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { showToast('Выберите изображение для обложки.'); return; }
      if (file.size > 8 * 1024 * 1024) { showToast('Обложка должна быть не больше 8 МБ.'); return; }
      if (pendingCoverUrl?.startsWith('blob:')) URL.revokeObjectURL(pendingCoverUrl);
      pendingCoverBlob = file;
      pendingCoverUrl = URL.createObjectURL(file);
      const cover = document.getElementById('coverPreview');
      const oldButton = document.getElementById('coverEditBtn');
      cover.innerHTML = `<img src="${escapeHtml(pendingCoverUrl)}" alt="" />`;
      const label = document.createElement('div');
      label.className = 'cover-label';
      label.textContent = 'Обложка';
      cover.appendChild(label);
      if (oldButton) cover.appendChild(oldButton);
      document.getElementById('coverInput').value = '';
    }

    async function goToPublish() {
      if (!pendingVideoBlob) return;
      stopCamera();
      showScreen('publish');
      const cover = document.getElementById('coverPreview');
      cover.innerHTML = '';
      if (pendingCoverUrl?.startsWith('blob:')) URL.revokeObjectURL(pendingCoverUrl);
      pendingCoverBlob = null;
      pendingCoverUrl = null;
      const coverButton = document.createElement('button');
      coverButton.className = 'cover-edit-btn';
      coverButton.id = 'coverEditBtn';
      coverButton.type = 'button';
      coverButton.textContent = 'Изменить обложку';
      coverButton.addEventListener('click', () => document.getElementById('coverInput').click());

      if (pendingThumbnailUrl && pendingThumbnailUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pendingThumbnailUrl);
        pendingThumbnailUrl = null;
      }
      pendingThumbnailBlob = null;

      if (pendingVideoBlob.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = pendingVideoUrl;
        img.alt = '';
        cover.appendChild(img);
      } else {
        pendingThumbnailBlob = await generateVideoThumbnail(pendingVideoUrl);
        if (pendingThumbnailBlob) {
          pendingThumbnailUrl = URL.createObjectURL(pendingThumbnailBlob);
          const img = document.createElement('img');
          img.src = pendingThumbnailUrl;
          img.alt = '';
          cover.appendChild(img);
        } else {
          const placeholder = document.createElement('div');
          placeholder.style.cssText = 'width:100%;height:100%;background:linear-gradient(135deg,#171717,#292929);';
          cover.appendChild(placeholder);
        }
      }
      const label = document.createElement('div'); label.className = 'cover-label'; label.textContent = 'Обложка'; cover.appendChild(label);
      cover.appendChild(coverButton);
    }

    async function publishVideo() {
      const user = await requireAuth('опубликовать видео');
      if (!user || !pendingVideoBlob) return;
      const desc = document.getElementById('pubDesc').value.trim() || 'Новое видео';
      const tagsText = document.getElementById('pubTags').value.trim() || '#fyp';
      const tags = parseTags(tagsText);
      const btn = document.getElementById('publishBtn');
      btn.disabled = true;
      btn.textContent = 'Загрузка…';

      const toast = document.getElementById('uploadToast');
      const progress = document.getElementById('uploadProgress');
      const pct = document.getElementById('uploadPct');
      const thumb = document.getElementById('uploadThumb');
      thumb.innerHTML = '';
      if (pendingThumbnailUrl) {
        const thumbImg = document.createElement('img');
        thumbImg.src = pendingThumbnailUrl;
        thumbImg.alt = '';
        thumb.appendChild(thumbImg);
      } else if (pendingVideoUrl && pendingVideoBlob?.type.startsWith('image/')) {
        const thumbImg = document.createElement('img');
        thumbImg.src = pendingVideoUrl;
        thumbImg.alt = '';
        thumb.appendChild(thumbImg);
      }
      toast.classList.add('visible'); progress.style.width = '6%'; pct.textContent = '6%';

      try {
        const file = pendingVideoBlob;
        const ext = (file.name?.split('.').pop() || (file.type.includes('image') ? 'jpg' : 'webm')).toLowerCase();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const contentType = file.type || (ext === 'mp4' ? 'video/mp4' : 'video/webm');
        const upload = await db.storage.from(STORAGE_BUCKET).upload(path, file, { contentType, upsert: false, cacheControl: '3600' });
        if (upload.error) throw upload.error;
        progress.style.width = '68%'; pct.textContent = '68%';

        const publicUrl = db.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
        const isImage = file.type.startsWith('image/');
        let thumbnailUrl = isImage ? publicUrl : null;

        const coverBlob = pendingCoverBlob || (!isImage ? pendingThumbnailBlob : null);
        if (coverBlob) {
          try {
            progress.style.width = '82%'; pct.textContent = '82%';
            const thumbExt = coverBlob.type === 'image/png' ? 'png' : 'jpg';
            const thumbPath = `${user.id}/thumbnails/${crypto.randomUUID()}.${thumbExt}`;
            const thumbUpload = await db.storage.from(STORAGE_BUCKET).upload(thumbPath, coverBlob, {
              contentType: coverBlob.type || 'image/jpeg',
              upsert: false,
              cacheControl: '86400'
            });
            if (!thumbUpload.error) {
              thumbnailUrl = db.storage.from(STORAGE_BUCKET).getPublicUrl(thumbPath).data.publicUrl;
            } else {
              console.warn('Thumbnail upload failed:', thumbUpload.error);
            }
          } catch (thumbnailError) {
            console.warn('Thumbnail generation/upload failed:', thumbnailError);
          }
        }
        const media = document.createElement(isImage ? 'img' : 'video');
        media.src = pendingVideoUrl;
        let duration = 0;
        if (!isImage) {
          duration = await new Promise(resolve => {
            const done = () => resolve(Number.isFinite(media.duration) ? Math.round(media.duration) : 0);
            media.addEventListener('loadedmetadata', done, { once: true });
            media.addEventListener('error', () => resolve(0), { once: true });
          });
        }

        const insertPayload = {
          user_id: user.id,
          description: desc,
          hashtags: tags,
          tags,
          media_type: isImage ? 'image' : 'video',
          media_url: publicUrl,
          video_url: isImage ? null : publicUrl,
          image_url: isImage ? publicUrl : null,
          thumbnail_url: thumbnailUrl,
          title: desc.slice(0, 80) || 'Без названия',
          sound: 'Оригинальный звук',
          sound_name: 'Оригинальный звук',
          username: currentUser.username,
          status: 'published',
          privacy: 'public',
          visibility: 'public',
          is_published: true,
          duration_seconds: duration,
          duration,
          size_bytes: file.size,
          likes: 0,
          views: 0,
          shares: 0,
          likes_count: 0,
          views_count: 0,
          shares_count: 0,
          comments_count: 0,
          saves_count: 0
        };
        const created = await db.from('videos').insert(insertPayload).select('*').single();
        if (created.error) throw created.error;
        progress.style.width = '100%'; pct.textContent = '100%';
        await loadRemoteData();
        showScreen('feed');
        currentFeedTab = 'foryou'; updateTopTabs(); renderFeed();
        toast.classList.remove('visible');
        resetPublishForm();
        showToast('Видео опубликовано.');
      } catch (error) {
        console.error('Publish error:', error);
        toast.classList.remove('visible');
        showToast(error?.message || 'Не удалось опубликовать видео.');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Выложить';
      }
    }

    function resetPublishForm() {
      if (pendingVideoUrl && pendingVideoUrl.startsWith('blob:')) URL.revokeObjectURL(pendingVideoUrl);
      if (pendingThumbnailUrl && pendingThumbnailUrl.startsWith('blob:')) URL.revokeObjectURL(pendingThumbnailUrl);
      if (pendingCoverUrl && pendingCoverUrl.startsWith('blob:')) URL.revokeObjectURL(pendingCoverUrl);
      pendingVideoBlob = null; pendingVideoUrl = null;
      pendingThumbnailBlob = null; pendingThumbnailUrl = null;
      pendingCoverBlob = null; pendingCoverUrl = null;
      document.getElementById('pubDesc').value = '';
      document.getElementById('pubTags').value = '';
      document.getElementById('galleryInput').value = '';
      document.getElementById('coverPreview').innerHTML = '';
      document.getElementById('nextBtn').classList.remove('visible');
    }

    // ========== STICKERS / COMMENTS HELPERS ==========
    const STICKERS = [
      { id:'spark', name:'Искры', svg:'<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="stk1" x1="0" x2="1"><stop stop-color="#ff4d6d"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><circle cx="40" cy="40" r="33" fill="url(#stk1)"/><path d="m40 12 6 18 18 6-18 6-6 18-6-18-18-6 18-6z" fill="#fff"/><circle cx="57" cy="21" r="4" fill="#ffd166"/></svg>' },
      { id:'fire', name:'Огонь', svg:'<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="stk2" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ff7b00"/><stop offset="1" stop-color="#ff2d55"/></linearGradient></defs><path d="M42 8c5 15-1 18 8 26 7 6 9 12 9 18 0 13-9 22-19 22-13 0-22-9-22-22 0-9 5-15 12-23 5-5 7-12 8-21z" fill="url(#stk2)"/><path d="M39 36c3 8-1 10 4 15 3 3 4 6 4 9 0 5-3 9-8 9-6 0-9-5-9-10 0-6 4-9 6-13 1-2 2-6 3-10z" fill="#ffd166"/></svg>' },
      { id:'love', name:'Любовь', svg:'<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="stk3"><stop stop-color="#ff4d6d"/><stop offset="1" stop-color="#ff9a9e"/></linearGradient></defs><circle cx="40" cy="40" r="33" fill="#22131a"/><path d="M40 60 34 54C20 42 14 35 14 27c0-7 5-12 12-12 6 0 10 3 14 8 4-5 8-8 14-8 7 0 12 5 12 12 0 8-6 15-20 27z" fill="url(#stk3)"/></svg>' },
      { id:'lol', name:'Смешно', svg:'<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="33" fill="#ffd84d"/><circle cx="27" cy="32" r="4" fill="#191919"/><circle cx="53" cy="32" r="4" fill="#191919"/><path d="M24 46c4 9 28 11 32 0" stroke="#191919" stroke-width="5" fill="none" stroke-linecap="round"/></svg>' },
      { id:'wow', name:'Вау', svg:'<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="33" fill="#f5c2ff"/><circle cx="28" cy="31" r="5" fill="#191919"/><circle cx="52" cy="31" r="5" fill="#191919"/><ellipse cx="40" cy="50" rx="7" ry="9" fill="#191919"/></svg>' },
      { id:'clap', name:'Аплодисменты', svg:'<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect x="17" y="21" width="18" height="42" rx="9" transform="rotate(-25 17 21)" fill="#f2b48d"/><rect x="31" y="14" width="15" height="44" rx="7" transform="rotate(-7 31 14)" fill="#f7c49e"/><rect x="45" y="19" width="14" height="40" rx="7" transform="rotate(12 45 19)" fill="#f2b48d"/><path d="M22 57c11 8 27 8 36-2" stroke="#b96d3f" stroke-width="4" fill="none" stroke-linecap="round"/></svg>' },
      { id:'party', name:'Праздник', svg:'<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="33" fill="#16213a"/><path d="m29 53 13-33 13 33z" fill="#6ee7ff"/><path d="M36 44h15" stroke="#fff" stroke-width="3"/><circle cx="23" cy="28" r="3" fill="#ff5d8f"/><circle cx="61" cy="24" r="3" fill="#ffd166"/><circle cx="59" cy="47" r="3" fill="#8b5cf6"/></svg>' },
      { id:'cool', name:'Круто', svg:'<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="33" fill="#8bd3ff"/><rect x="18" y="29" width="20" height="10" rx="5" fill="#111827"/><rect x="42" y="29" width="20" height="10" rx="5" fill="#111827"/><path d="M28 49c7 5 17 5 24 0" stroke="#111827" stroke-width="4" fill="none" stroke-linecap="round"/></svg>' },
      { id:'heart', name:'Сердце', svg:'<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="33" fill="#26131a"/><path d="m40 61-6-6C22 44 16 38 16 30c0-7 5-12 12-12 5 0 9 2 12 7 3-5 7-7 12-7 7 0 12 5 12 12 0 8-6 14-18 25z" fill="#ff365b"/></svg>' },
      { id:'sparkle', name:'Сияние', svg:'<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><circle cx="40" cy="40" r="33" fill="#172033"/><path d="m40 10 5 22 22 8-22 8-5 22-5-22-22-8 22-8z" fill="#f6f1a7"/><circle cx="59" cy="19" r="3" fill="#fff"/></svg>' }
    ];
    const EMOJIS = ['😀','😂','🥹','😍','🤩','😎','🔥','❤️','💯','👏','🎉','✨','👍','🙏','🤣','😱','🥰','😅','🤝','🫶','😈','🤔','😭','😮','🙌','💪','🎵','🚀','🌟','💖'];
    function stickerById(id){ return STICKERS.find(s=>s.id===id) || null; }
    function stickerDataUrl(id){ const s=stickerById(id); return s ? `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(s.svg)}` : ''; }
    function stickerSvg(id,size=74){ const s=stickerById(id); return s ? s.svg.replace('<svg ', `<svg width="${size}" height="${size}" class="sticker-item" `) : ''; }
    function customStickerUrl(id){ return customStickers.get(String(id))?.url || ''; }
    function customStickerImage(id,size=42){
      const url=customStickerUrl(id);
      return url ? `<img src="${escapeHtml(url)}" alt="" class="custom-sticker-item" width="${size}" height="${size}" />` : '';
    }
    function renderStickerPicker(tab=currentStickerTab){
      currentStickerTab=tab;
      document.querySelectorAll('[data-sticker-tab]').forEach(b=>b.classList.toggle('active',b.dataset.stickerTab===tab));
      const grid=document.getElementById('stickerGrid'); if(!grid) return;
      if(tab==='emoji'){
        grid.innerHTML = EMOJIS.map(e=>`<button type="button" data-emoji="${escapeHtml(e)}"><span class="emoji-item">${e}</span></button>`).join('');
        return;
      }
      const custom = [...customStickers.entries()].map(([id,st])=>`<button type="button" data-custom-sticker-id="${escapeHtml(id)}" title="${escapeHtml(st.name || 'Мой стикер')}">${customStickerImage(id,42)}</button>`).join('');
      grid.innerHTML = `<button type="button" class="sticker-add-button" id="addStickerButton">${icon('plus',18)}<span>Добавить стикер</span></button>`
        + custom
        + STICKERS.map(s=>`<button type="button" data-sticker-id="${escapeHtml(s.id)}" title="${escapeHtml(s.name)}">${stickerSvg(s.id,42)}</button>`).join('');
    }
    function openStickerPicker(){ const p=document.getElementById('stickerPicker'); if(!p) return; p.classList.toggle('visible'); if(p.classList.contains('visible')) renderStickerPicker(currentStickerTab); }
    function closeStickerPicker(){ document.getElementById('stickerPicker')?.classList.remove('visible'); }
    async function addCustomSticker(file){
      if(customStickerUploadBusy || !file) return;
      const user=await requireAuth('добавить свой стикер'); if(!user) return;
      if(!file.type.startsWith('image/')) { showToast('Выберите изображение.'); return; }
      if(file.size > 5*1024*1024){ showToast('Стикер должен быть не больше 5 МБ.'); return; }
      customStickerUploadBusy=true;
      try{
        const ext=(file.name.split('.').pop()||'png').toLowerCase();
        const id=`custom-${crypto.randomUUID()}`;
        const path=`${user.id}/stickers/${crypto.randomUUID()}.${ext}`;
        const upload=await db.storage.from(STORAGE_BUCKET).upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
        if(upload.error) throw upload.error;
        const url=db.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
        const name=(file.name||'Мой стикер').replace(/\.[^.]+$/,'').slice(0,40);
        const {error}=await db.from('saved_stickers').upsert({user_id:user.id,sticker_id:id,sticker_url:url},{onConflict:'user_id,sticker_id'});
        if(error) throw error;
        customStickers.set(id,{url,name,path});
        renderStickerPicker('stickers');
        showToast('Стикер добавлен.');
      }catch(error){ console.error(error); showToast('Не удалось добавить стикер.'); }
      finally{ customStickerUploadBusy=false; }
    }

    async function sendCustomSticker(stickerId){
      const user=await requireAuth('отправить стикер');
      const sticker=customStickers.get(String(stickerId));
      if(!user || !currentCommentsVideoId || !sticker) return;
      try{
        const {error}=await db.from('comments').insert({user_id:user.id,video_id:currentCommentsVideoId,text:'',content:'',comment_type:'sticker',sticker_id:stickerId,sticker_url:sticker.url});
        if(error) throw error;
        closeStickerPicker(); await openComments(currentCommentsVideoId);
      }catch(error){
        console.error('Custom sticker send error:', error);
        showToast(error?.message || 'Не удалось отправить стикер.');
      }
    }

    async function sendSticker(stickerId){
      const user=await requireAuth('отправить стикер'); if(!user || !currentCommentsVideoId || !stickerById(stickerId)) return;
      try{
        const {error}=await db.from('comments').insert({user_id:user.id,video_id:currentCommentsVideoId,text:'',content:'',comment_type:'sticker',sticker_id:stickerId});
        if(error) throw error;
        closeStickerPicker(); await openComments(currentCommentsVideoId);
      }catch(error){
        console.error('Sticker send error:', error);
        showToast(error?.message || 'Не удалось отправить стикер.');
      }
    }
    function addEmojiToComment(emoji){ const input=document.getElementById('commentInput'); if(!input)return; input.value += emoji; input.focus(); }
    function openCommentContext(commentId,stickerId,stickerUrl,x,y){
      const menu=document.getElementById('commentContextMenu'); if(!menu)return;
      currentCommentContextId=commentId; currentCommentContextStickerId=stickerId; currentCommentContextStickerUrl=stickerUrl || ''; menu.classList.add('visible');
      menu.style.left=`${Math.max(8,Math.min(x,window.innerWidth-205))}px`; menu.style.top=`${Math.max(8,Math.min(y,window.innerHeight-150))}px`;
    }
    function closeCommentContext(){ const menu=document.getElementById('commentContextMenu'); menu?.classList.remove('visible'); currentCommentContextId=null; currentCommentContextStickerId=null; currentCommentContextStickerUrl=''; }
    async function hideCurrentComment(){
      const user=await requireAuth('скрыть комментарий'); if(!user||!currentCommentContextId)return;
      try{ const {error}=await db.from('hidden_comments').upsert({user_id:user.id,comment_id:currentCommentContextId},{onConflict:'user_id,comment_id'}); if(error)throw error; hiddenCommentIds.add(currentCommentContextId); closeCommentContext(); await openComments(currentCommentsVideoId); showToast('Комментарий скрыт для вас.'); }
      catch(error){ console.error(error); showToast('Не удалось скрыть комментарий.'); }
    }
    async function saveCurrentSticker(){
      const user=await requireAuth('сохранить стикер'); if(!user||!currentCommentContextStickerId)return;
      try{ const url=currentCommentContextStickerUrl || customStickerUrl(currentCommentContextStickerId) || stickerDataUrl(currentCommentContextStickerId); if(!url) throw new Error('У стикера нет изображения'); const {error}=await db.from('saved_stickers').upsert({user_id:user.id,sticker_id:currentCommentContextStickerId,sticker_url:url},{onConflict:'user_id,sticker_id'}); if(error)throw error; customStickers.set(currentCommentContextStickerId,{url,name:stickerById(currentCommentContextStickerId)?.name || 'Сохранённый стикер'}); closeCommentContext(); showToast('Стикер сохранён.'); }
      catch(error){ console.error(error); showToast('Не удалось сохранить стикер.'); }
    }
    async function toggleCommentLike(commentId){
      const user=await requireAuth('лайкнуть комментарий'); if(!user)return;
      const liked=likedCommentIds.has(commentId);
      try{
        if(liked){ const {error}=await db.from('comment_likes').delete().eq('comment_id',commentId).eq('user_id',user.id); if(error)throw error; likedCommentIds.delete(commentId); }
        else { const {error}=await db.from('comment_likes').insert({comment_id:commentId,user_id:user.id}); if(error)throw error; likedCommentIds.add(commentId); }
        const btn=document.querySelector(`[data-comment-like="${CSS.escape(commentId)}"]`); if(btn){ const count=Number(btn.dataset.count||0)+(liked?-1:1); btn.dataset.count=String(Math.max(0,count)); btn.classList.toggle('liked',!liked); btn.innerHTML=`${icon(!liked?'heartFill':'heart',16)} <span>${formatCount(Math.max(0,count))}</span>`; }
      }catch(error){ console.error(error); showToast('Не удалось изменить лайк.'); }
    }
    async function loadCommentInteractionState(commentIds){
      hiddenCommentIds.clear(); likedCommentIds.clear(); if(!authUser || !commentIds.length)return;
      const [hidden,liked]=await Promise.all([
        db.from('hidden_comments').select('comment_id').eq('user_id',authUser.id).in('comment_id',commentIds),
        db.from('comment_likes').select('comment_id').eq('user_id',authUser.id).in('comment_id',commentIds)
      ]);
      (hidden.data||[]).forEach(x=>hiddenCommentIds.add(x.comment_id)); (liked.data||[]).forEach(x=>likedCommentIds.add(x.comment_id));
    }

    // ========== MODALS / COMMENTS ==========
    function setupModals() {
      document.querySelectorAll('.modal-overlay').forEach(m => m.addEventListener('click', e => { if (e.target === m) closeModals(); }));
      document.getElementById('speedOptions').addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        document.querySelectorAll('#speedOptions button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = parseFloat(btn.dataset.speed);
        document.querySelectorAll('.video-card video').forEach(v => { v.playbackRate = speed; });
        closeModals();
      });
      document.getElementById('favoriteAction').addEventListener('click', () => toggleFavorite(currentMoreVideoId));
      document.getElementById('shareOptions').addEventListener('click', e => {
        const btn = e.target.closest('[data-share-kind]');
        if (!btn || !currentShareVideoId) return;
        shareVideoTo(btn.dataset.shareKind, currentShareVideoId);
      });
      document.getElementById('commentStickerBtn').addEventListener('click', openStickerPicker);
      document.querySelectorAll('[data-sticker-tab]').forEach(t => t.addEventListener('click', () => renderStickerPicker(t.dataset.stickerTab)));
      document.getElementById('stickerGrid').addEventListener('click', e => {
        const addBtn=e.target.closest('#addStickerButton'); if(addBtn){ document.getElementById('stickerUploadInput')?.click(); return; }
        const customBtn=e.target.closest('[data-custom-sticker-id]'); if(customBtn){ sendCustomSticker(customBtn.dataset.customStickerId); return; }
        const stickerBtn=e.target.closest('[data-sticker-id]'); if(stickerBtn){ sendSticker(stickerBtn.dataset.stickerId); return; }
        const emojiBtn=e.target.closest('[data-emoji]'); if(emojiBtn) addEmojiToComment(emojiBtn.dataset.emoji);
      });
      document.getElementById('stickerUploadInput').addEventListener('change', e => { const file=e.target.files?.[0]; if(file) addCustomSticker(file); e.target.value=''; });
      document.getElementById('hideCommentAction').addEventListener('click', hideCurrentComment);
      document.getElementById('saveStickerAction').addEventListener('click', saveCurrentSticker);
      document.getElementById('cancelCommentContext').addEventListener('click', closeCommentContext);
      document.getElementById('chatSendBtn')?.addEventListener('click', sendChatMessage);
      document.getElementById('chatBackBtn')?.addEventListener('click', closeDirectChat);
      document.getElementById('chatCloseBtn')?.addEventListener('click', closeDirectChat);
      document.getElementById('chatInput')?.addEventListener('keydown', e => { if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendChatMessage(); } });
      document.getElementById('chatInput')?.addEventListener('input', e => { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,110)+'px'; });
      document.querySelectorAll('.auth-tab').forEach(t => t.addEventListener('click', () => setAuthMode(t.dataset.authMode)));
      document.getElementById('authSubmit').addEventListener('click', submitAuth);
      document.getElementById('authClose').addEventListener('click', closeModals);
      document.getElementById('emailResendBtn').addEventListener('click', resendConfirmationEmail);
      document.getElementById('emailCancelBtn').addEventListener('click', closeModals);
      document.getElementById('authForgot').addEventListener('click', sendPasswordReset);
      document.getElementById('recoverySendBtn').addEventListener('click', () => sendRecoveryCode(true));
      document.getElementById('recoveryVerifyBtn').addEventListener('click', verifyRecoveryCode);
      document.getElementById('recoveryResendBtn').addEventListener('click', resendRecoveryCode);
      document.getElementById('recoveryBackToEmailBtn').addEventListener('click', () => { stopRecoveryResendTimer(); setPasswordRecoveryStep(1); });
      document.getElementById('recoveryBackToCodeBtn').addEventListener('click', () => { setPasswordRecoveryStep(2); setTimeout(() => document.getElementById('recoveryCode')?.focus(), 40); });
      document.getElementById('passwordResetBtn').addEventListener('click', saveNewPassword);
      document.getElementById('passwordResetCancelBtn').addEventListener('click', () => { stopRecoveryResendTimer(); closeModals(); });
      document.getElementById('recoveryCode').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 8); });
      document.getElementById('recoveryCode').addEventListener('keydown', e => { if (e.key === 'Enter') verifyRecoveryCode(); });
      document.getElementById('recoveryEmail').addEventListener('keydown', e => { if (e.key === 'Enter') sendRecoveryCode(true); });
      document.getElementById('newPasswordRepeat').addEventListener('keydown', e => { if (e.key === 'Enter') saveNewPassword(); });
      document.getElementById('profileEditClose').addEventListener('click', closeModals);
      document.getElementById('profileEditCancel').addEventListener('click', closeModals);
      document.getElementById('profileEditSave').addEventListener('click', saveProfileEdits);
      document.getElementById('profileEditAvatarBtn').addEventListener('click', () => {
        if (!document.getElementById('profileEditAvatarBtn').disabled) document.getElementById('profileEditAvatarInput').click();
      });
      document.getElementById('profileEditAvatarInput').addEventListener('change', e => {
        previewProfileEditAvatar(e.target.files?.[0]);
        e.target.value = '';
      });
      document.getElementById('profileEditUsername').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0,30); });
      document.getElementById('profileEditBio').addEventListener('input', updateProfileBioCounter);
      document.getElementById('authPassword').addEventListener('keydown', e => { if (e.key === 'Enter') submitAuth(); });
      document.addEventListener('click', e => { if (!e.target.closest('#commentContextMenu') && !e.target.closest('.comment-item')) closeCommentContext(); });
      document.addEventListener('contextmenu', e => {
        const item=e.target.closest('.comment-item[data-comment-id]');
        if(!item || item.dataset.commentType!=='sticker') return;
        e.preventDefault(); openCommentContext(item.dataset.commentId,item.dataset.stickerId,item.dataset.stickerUrl,e.clientX,e.clientY);
      });
      document.addEventListener('touchstart', e => {
        const item=e.target.closest('.comment-item[data-comment-id]'); if(!item || item.dataset.commentType!=='sticker') return;
        const touch=e.touches[0];
        commentLongPressTimer=setTimeout(()=>openCommentContext(item.dataset.commentId,item.dataset.stickerId,item.dataset.stickerUrl,touch.clientX,touch.clientY),550);
      }, {passive:true});
      ['touchend','touchmove','touchcancel'].forEach(type=>document.addEventListener(type,()=>{if(commentLongPressTimer){clearTimeout(commentLongPressTimer);commentLongPressTimer=null;}},{passive:true}));
    }

    function closeModals() { stopRecoveryResendTimer(); document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('visible')); closeCommentContext(); closeStickerPicker(); resetProfileEditDraft(); profileEditOriginal = null; profileEditAvatarUrl = ''; currentShareVideoId = null; }
    function openSpeedModal() { closeModals(); document.getElementById('speedModal').classList.add('visible'); }
    function openMore(videoId) {
      currentMoreVideoId = videoId;
      const v = videos.find(x => x.id === videoId);
      const fav = document.getElementById('favoriteAction');
      const del = document.getElementById('deleteCurrentVideoAction');
      const report = document.getElementById('reportCurrentVideoAction');
      if (fav) {
        fav.style.display = '';
        fav.innerHTML = `${v?.favorited ? icon('bookmarkFill',18) : icon('bookmark',18)} ${v?.favorited ? 'Удалить из избранного' : 'В избранное'}`;
      }
      const isOwner = Boolean(authUser && v && String(v.authorId || v.author?.id) === String(authUser.id));
      if (del) del.style.display = isOwner ? 'flex' : 'none';
      if (report) report.style.display = isOwner ? 'none' : '';
      closeModals();
      // closeModals intentionally resets overlays only; restore the owner-specific action state after it runs.
      if (del) del.style.display = isOwner ? 'flex' : 'none';
      if (report) report.style.display = isOwner ? 'none' : '';
      document.getElementById('moreModal').classList.add('visible');
      hydrateIcons(document.getElementById('moreModal'));
    }

    function getStoragePathFromPublicUrl(url) {
      try {
        const parsed = new URL(String(url || ''));
        const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
        const idx = parsed.pathname.indexOf(marker);
        if (idx === -1) return null;
        return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
      } catch (_) { return null; }
    }

    async function deleteCurrentVideo() {
      const id = String(currentMoreVideoId || '');
      const v = videos.find(x => String(x.id) === id);
      if (!v) { closeModals(); return; }
      const user = await requireAuth('удалить публикацию');
      if (!user) return;
      if (String(v.authorId || v.author?.id) !== String(user.id)) {
        closeModals();
        showToast('Удалять можно только свои публикации.');
        return;
      }
      const confirmed = window.confirm('Удалить эту публикацию? Это действие нельзя отменить.');
      if (!confirmed) return;

      try {
        if (v.remote) {
          const { error } = await db.from('videos').delete().eq('id', id).eq('user_id', user.id);
          if (error) throw error;
          const storagePath = getStoragePathFromPublicUrl(v.src);
          if (storagePath) {
            const cleanup = await db.storage.from(STORAGE_BUCKET).remove([storagePath]);
            if (cleanup.error) console.warn('Video storage cleanup failed:', cleanup.error);
          }
        }
        const idx = videos.findIndex(x => String(x.id) === id);
        if (idx !== -1) videos.splice(idx, 1);
        viewedVideos.delete(id);
        closeModals();
        renderFeed({ reshuffle: false });
        if (currentProfile && String(currentProfile.id) === String(user.id)) renderProfileGrid('videos');
        showToast('Публикация удалена.');
      } catch (error) {
        console.error('Delete video error:', error);
        showToast(error?.message ? `Не удалось удалить публикацию: ${error.message}` : 'Не удалось удалить публикацию.');
      }
    }

    function donationUsernameValue() {
      return String(currentUser?.donationUsername || '').trim().replace(/^@+/, '');
    }

    function donationPageUrl(username) {
      const clean = String(username || '').trim().replace(/^@+/, '');
      return clean ? `https://www.donationalerts.com/r/${encodeURIComponent(clean)}` : '';
    }

    function formatDonationAmount(amount, currency = 'RUB') {
      const value = Number(amount || 0);
      const formatted = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
      return `${formatted} ${String(currency || 'RUB').toUpperCase()}`;
    }

    function formatDonationTime(value) {
      try { return new Intl.DateTimeFormat('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(value)); }
      catch (_) { return ''; }
    }

    async function openDonationForAuthor(author) {
      const username = String(author?.donationUsername || '').trim().replace(/^@+/, '');
      if (!username) { showToast('Автор ещё не подключил DonationAlerts.'); return; }
      const url = donationPageUrl(username);
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (_) {
        window.location.href = url;
      }
    }

    async function openDonationForVideo(videoId) {
      const v = videos.find(x => String(x.id) === String(videoId));
      if (!v?.author) { showToast('Автор недоступен.'); return; }
      await openDonationForAuthor(v.author);
    }

    function donationEventMarkup(donation) {
      const gold = Boolean(donation.is_gold);
      const donor = escapeHtml(donation.donor_name || 'Аноним');
      const avatar = escapeHtml(fallbackAvatar(donation.donor_name || 'А'));
      const displayMessage = donation.message ? maskModeratedText(donation.message) : '';
      const message = displayMessage ? `<div class="donation-message">${escapeHtml(displayMessage)}</div>` : '';
      const systemText = `<div class="donation-system-text">@${donor} задонатил ${escapeHtml(formatDonationAmount(donation.amount, donation.currency))}</div>`;
      return `<div class="donation-comment ${gold?'gold':''}" data-donation-id="${escapeHtml(donation.id)}"><div class="donation-avatar"><img src="${avatar}" alt="" /></div><div class="donation-main"><div class="donation-name-row"><div class="donation-name">@${donor}</div><div class="donation-amount">${escapeHtml(formatDonationAmount(donation.amount, donation.currency))}</div>${gold?`<span class="donation-badge">${icon('donate',11)} Золотой комментарий</span>`:''}</div>${systemText}${message}<div class="donation-meta">${gold?`<span class="donation-pin">📌 Закреплён</span> · `:''}${escapeHtml(formatDonationTime(donation.donation_created_at))}</div></div></div>`;
    }

    async function loadDonationComments(videoId, creatorId) {
      const result = await db.from('donation_events')
        .select('id,creator_id,external_id,donor_name,amount,amount_rub,currency,message,video_id,donation_created_at,is_gold,is_pinned')
        .eq('creator_id', creatorId)
        .or(`video_id.eq.${videoId},is_gold.eq.true`)
        .order('is_gold', { ascending:false })
        .order('donation_created_at', { ascending:false })
        .limit(40);
      if (result.error) throw result.error;
      return result.data || [];
    }

    function renderDonationSection(donations) {
      if (!donations.length) return '';
      const gold = donations.filter(d => d.is_gold && d.is_pinned);
      const rest = donations.filter(d => !(d.is_gold && d.is_pinned));
      return `<div class="donation-comments-section"><div class="donation-section-title"><span>Поддержка автора</span><span>${donations.length}</span></div>${gold.map(donationEventMarkup).join('')}${rest.map(donationEventMarkup).join('')}</div>`;
    }

    async function saveDonationProfileSettings() {
      const user = await requireAuth('настроить донаты'); if (!user) return;
      const input = document.getElementById('donationUsernameInput');
      const toggle = document.getElementById('donationEnabledToggle');
      const username = String(input?.value || '').trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9_\-\.]+/g, '').slice(0,80);
      const enabled = Boolean(toggle?.checked) && Boolean(username);
      try {
        const { data, error } = await db.from('profiles').update({
          donationalerts_username: username || null,
          donationalerts_enabled: enabled
        }).eq('id', user.id).select('id,name,display_name,username,avatar_url,bio,followers_count,following_count,likes_count,videos_count,is_private,is_verified,donationalerts_username,donationalerts_enabled,donationalerts_connected').single();
        if (error) throw error;
        currentUser = userFromProfile(data);
        profileCache.set(currentUser.id, currentUser);
        if (userSettings) renderSettings();
        renderFeed({ reshuffle:false });
        showToast(username ? 'Настройки донатов сохранены.' : 'Username донатов очищен.');
      } catch (e) {
        console.error('Donation profile save error:', e);
        showToast('Не удалось сохранить настройки донатов.');
      }
    }

    async function connectDonationAlerts() {
      const user = await requireAuth('подключить DonationAlerts'); if (!user) return;
      try {
        const { data, error } = await db.functions.invoke('donationalerts', { body: { action:'authorize' } });
        if (error) throw error;
        if (!data?.url) throw new Error(data?.error || 'Ссылка авторизации не получена.');
        window.location.href = data.url;
      } catch (e) {
        console.error('DonationAlerts connect error:', e);
        showToast(e?.message || 'Не удалось открыть подключение DonationAlerts.');
      }
    }

    async function disconnectDonationAlerts() {
      const user = await requireAuth('отключить DonationAlerts'); if (!user) return;
      try {
        const { data, error } = await db.functions.invoke('donationalerts', { body: { action:'disconnect' } });
        if (error) throw error;
        if (!data?.disconnected) throw new Error(data?.error || 'Не удалось отключить.');
        await refreshAuthState();
        renderSettings();
        showToast('DonationAlerts отключён.');
      } catch (e) {
        console.error('DonationAlerts disconnect error:', e);
        showToast(e?.message || 'Не удалось отключить DonationAlerts.');
      }
    }

    async function syncDonationAlerts() {
      if (!authUser || !currentUser?.donationConnected) return;
      try {
        const { data, error } = await db.functions.invoke('donationalerts', { body:{ action:'sync' } });
        if (error) throw error;
        if (Number(data?.newCount || 0) > 0) {
          showToast(`Новых донатов: ${data.newCount}`);
          if (currentCommentsVideoId) await openComments(currentCommentsVideoId);
        }
      } catch (e) {
        console.warn('DonationAlerts sync:', e?.message || e);
      }
    }

    function stopDonationSync() {
      if (donationSyncTimer) { clearInterval(donationSyncTimer); donationSyncTimer = null; }
    }

    function startDonationSync() {
      stopDonationSync();
      if (!authUser || !currentUser?.donationConnected) return;
      setTimeout(() => syncDonationAlerts(), 1200);
      donationSyncTimer = setInterval(syncDonationAlerts, 25000);
    }

    let inboxRealtimeChannel = null;
    function handleLiveNotification(row){
      if(!row || !authUser || String(row.user_id)!==String(authUser.id)) return;
      const allowed=notificationSettingFor(row.type);
      const suppressed=isDndActive();
      const activeTab=document.querySelector('.inbox-tabs .itab.active')?.dataset.itab||'notifs';
      if(currentScreenName==='inbox') renderInbox(activeTab).catch(()=>{});
      const inboxBtn=document.querySelector('.bottom-nav .btn[data-screen=\"inbox\"]');
      if(inboxBtn && allowed && !suppressed){ inboxBtn.classList.add('has-unread'); inboxBtn.setAttribute('data-unread','1'); }
      if(!allowed || suppressed || userSettings.push_enabled!==true || !('Notification' in window) || Notification.permission!=='granted') return;
      try{
        const actor=row.actor_id&&profileCache.get(row.actor_id);
        const title=row.type==='donation'?'Новый донат':row.type==='message'?'Новое сообщение':'Смотрю';
        new Notification(title,{body:`${actor?.name?actor.name+': ':''}${row.text||'Новое событие в вашем аккаунте'}`,tag:`smotriu-${row.id}`});
      }catch(e){ console.warn('browser notification',e); }
    }
    function setupInboxRealtime(){
      try{
        if(inboxRealtimeChannel) db.removeChannel(inboxRealtimeChannel);
        inboxRealtimeChannel=db.channel('smotry-inbox-realtime').on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications'},payload=>handleLiveNotification(payload?.new)).subscribe();
      }catch(e){ console.warn('Inbox realtime setup:',e); }
    }

    function setupDonationRealtime() {
      try {
        donationRealtimeChannel = db.channel('smotry-donation-events')
          .on('postgres_changes', { event:'INSERT', schema:'public', table:'donation_events' }, payload => {
            const row = payload?.new;
            if (!row) return;
            const isCurrentAuthor = currentProfile && String(currentProfile.id) === String(row.creator_id);
            const affectsOpenVideo = currentCommentsVideoId && String(currentCommentsVideoId) === String(row.video_id);
            if (isCurrentAuthor || affectsOpenVideo) {
              if (currentCommentsVideoId) openComments(currentCommentsVideoId).catch(()=>{});
            }
          })
          .subscribe();
      } catch (e) { console.warn('Donation realtime setup:', e); }
    }

    function handleDonationAlertsReturn() {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('donationalerts');
      if (!status) return;
      try {
        const clean = new URL(window.location.href);
        clean.searchParams.delete('donationalerts');
        window.history.replaceState({}, document.title, clean.href);
      } catch (_) {}
      if (status === 'connected') {
        setTimeout(async () => {
          await refreshAuthState();
          await syncDonationAlerts();
          showToast('DonationAlerts подключён.');
          if (currentSettingsTab === 'donations' && document.getElementById('settingsContent')) renderSettings();
        }, 100);
      } else if (status === 'error') {
        setTimeout(() => showToast('Не удалось подключить DonationAlerts.'), 100);
      }
    }

    // ========== COMMENT MODERATION ==========
    const COMMENT_PROFANITY_TERMS = [
      'бляд','бля','блять','ебан','ебать','ебл','еблан','ебись','нахуй','пизд','пиздец','хуйн','хуй','мудак','мраз','суч','шлюх','дроч','говн','дерьм','залуп','уеб','ёб','fuck','fucker','motherfucker','shit','bitch'
    ];
    const COMMENT_INSULT_TERMS = [
      'дебил','идиот','кретин','тупиц','тупой','урод','ничтож','жалк','лох','лошар','долбо','придур','козел','козёл','чмо','даун','мусор','позор','тварь','дегенерат','баран'
    ];

    function normalizeModerationText(value){
      return String(value||'')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/ё/g,'е')
        .replace(/[aàáâäãå]/g,'a')
        .replace(/[eèéêë]/g,'e')
        .replace(/[oòóôöõ]/g,'o')
        .replace(/[cç]/g,'c')
        .replace(/[xх]/g,'x')
        .replace(/[yу]/g,'y')
        .replace(/[0]/g,'o')
        .replace(/[1]/g,'i')
        .replace(/[3]/g,'e')
        .replace(/[4]/g,'a')
        .replace(/[5]/g,'s')
        .replace(/([a-zа-яё])\1{2,}/gu,'$1$1');
    }

    function moderationCompact(value){
      return normalizeModerationText(value).replace(/[^a-zа-я0-9]+/giu,'');
    }

    function hasModerationTerm(value, terms){
      const normalized=moderationCompact(value);
      return terms.some(term=>normalized.includes(moderationCompact(term)));
    }

    function strictToxicPhrase(value){
      const raw=normalizeModerationText(value).trim();
      if(!raw || raw.length>64) return false;
      const compact=moderationCompact(raw);
      if(/^фу+[a-zа-я0-9]{0,14}$/iu.test(compact)) return true;
      if(/^кринж[a-zа-я0-9]{0,14}$/iu.test(compact)) return true;
      if(/\bты\s+(кринж|тупой|тупица|идиот|дебил|урод)\b/iu.test(raw)) return true;
      if(/\bфу\s+ты\b/iu.test(raw)) return true;
      return false;
    }

    function moderateCommentText(value){
      const text=String(value||'').trim();
      if(!text) return {allowed:false,reason:'empty'};
      if(!userSettings.comment_moderation_enabled) return {allowed:true,reason:''};
      if(hasModerationTerm(text,COMMENT_PROFANITY_TERMS)) return {allowed:false,reason:'profanity'};
      if(hasModerationTerm(text,COMMENT_INSULT_TERMS)) return {allowed:false,reason:'insult'};
      if(Number(userSettings.comment_moderation_level||2)>=2 && strictToxicPhrase(text)) return {allowed:false,reason:'toxicity'};
      const hidden=(userSettings.hidden_words||[]).map(x=>String(x).trim()).filter(Boolean);
      const lower=normalizeModerationText(text);
      if(hidden.some(word=>lower.includes(normalizeModerationText(word)))) return {allowed:false,reason:'hidden_word'};
      return {allowed:true,reason:''};
    }

    function moderationMessage(reason){
      if(reason==='profanity') return 'Комментарий не опубликован: обнаружена нецензурная лексика.';
      if(reason==='insult') return 'Комментарий не опубликован: обнаружено оскорбление.';
      if(reason==='toxicity') return 'Комментарий не опубликован: слишком токсичная формулировка.';
      if(reason==='hidden_word') return 'Комментарий не опубликован: используется скрытое слово.';
      return 'Комментарий не опубликован.';
    }

    function maskModeratedText(value){
      const text=String(value||'');
      if(!text) return '';
      let masked=text;
      [...COMMENT_PROFANITY_TERMS,...COMMENT_INSULT_TERMS].forEach(term=>{
        const safe=String(term).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        if(!safe) return;
        masked=masked.replace(new RegExp(safe,'giu',),match=>'•'.repeat(Math.max(2,match.length)));
      });
      masked=masked.replace(/\bкринж\b/giu,'•••••').replace(/\bфу\b/giu,'••');
      return masked;
    }

    async function openComments(videoId) {
      currentCommentsVideoId = videoId;
      closeCommentContext();
      closeStickerPicker();
      const list = document.getElementById('commentsList');
      const donateBtn = document.getElementById('commentDonateBtn');
      const currentVideo = videos.find(x => String(x.id) === String(videoId));
      const author = currentVideo?.author;
      if (donateBtn) {
        donateBtn.style.display = author?.donationEnabled && author?.donationUsername ? 'flex' : 'none';
        donateBtn.innerHTML = `${icon('donate',15)} Поддержать @${escapeHtml(author?.username || 'автора')}`;
        donateBtn.onclick = () => openDonationForAuthor(author);
      }
      list.innerHTML = `<div class="empty-state"><div class="icon">${icon('message',36)}</div><div>Загрузка…</div></div>`;
      document.getElementById('commentsModal').classList.add('visible');
      document.getElementById('commentInput').value = '';
      try {
        const { data, error } = await db.from('comments').select('id,text,content,user_id,created_at,likes_count,comment_type,sticker_id,sticker_url').eq('video_id', videoId).order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        const ids = [...new Set((data || []).map(c => c.user_id).filter(Boolean))];
        if (ids.length) {
          const { data: profiles } = await db.from('profiles').select('id,name,display_name,username,avatar_url,donationalerts_username,donationalerts_enabled,donationalerts_connected').in('id', ids);
          (profiles || []).forEach(p => profileCache.set(p.id, userFromProfile(p)));
        }
        await loadCommentInteractionState((data || []).map(c => c.id));
        const visible = (data || []).filter(c => !hiddenCommentIds.has(c.id));
        let donationEvents = [];
        if (author?.id && author?.donationConnected) {
          try { donationEvents = await loadDonationComments(videoId, author.id); }
          catch (e) { console.warn('Donation comments load:', e); }
        }

        const regularMarkup = visible.map(c => {
          const u = profileCache.get(c.user_id) || {name:'Пользователь',avatar:fallbackAvatar('П')};
          const type = c.comment_type || (c.sticker_id ? 'sticker' : 'text');
          const count = Number(c.likes_count || 0);
          const liked = likedCommentIds.has(c.id);
          const content = type === 'sticker' && c.sticker_id ? (c.sticker_url ? `<div class="comment-sticker"><img src="${escapeHtml(c.sticker_url)}" alt="Стикер" /></div>` : `<div class="comment-sticker">${stickerSvg(c.sticker_id,74)}</div>`) : `<div class="c-text comment-textual">${escapeHtml(c.text || c.content || '')}</div>`;
          return `<div class="comment-item" data-comment-id="${escapeHtml(c.id)}" data-comment-type="${escapeHtml(type)}" data-sticker-id="${escapeHtml(c.sticker_id || '')}" data-sticker-url="${escapeHtml(c.sticker_url || '')}"><div class="c-avatar comment-author-avatar" data-userid="${escapeHtml(c.user_id || '')}" role="button" tabindex="0" aria-label="Открыть профиль ${escapeHtml(u.name)}"><img src="${escapeHtml(u.avatar)}" alt="" /></div><div class="comment-main"><div class="c-name">${escapeHtml(u.name)}</div>${content}<div class="comment-actions"><button type="button" class="comment-like-btn ${liked?'liked':''}" data-comment-like="${escapeHtml(c.id)}" data-count="${count}" aria-label="Нравится">${icon(liked?'heartFill':'heart',16)} <span>${formatCount(count)}</span></button></div></div></div>`;
        }).join('');
        const emptyRegular = `<div class="empty-state" style="padding:18px 10px"><div class="icon">${icon('message',30)}</div><div>${visible.length ? '' : 'Пока нет обычных комментариев.'}</div></div>`;
        const donationsMarkup = renderDonationSection(donationEvents);
        list.innerHTML = `${donationsMarkup}${visible.length ? regularMarkup : emptyRegular}`;
        hydrateIcons(list);
        list.querySelectorAll('[data-comment-like]').forEach(btn => btn.addEventListener('click', () => toggleCommentLike(btn.dataset.commentLike)));
        list.querySelectorAll('.comment-author-avatar[data-userid]').forEach(avatar => {
          avatar.addEventListener('click', e => { e.stopPropagation(); openProfile(avatar.dataset.userid); });
          avatar.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProfile(avatar.dataset.userid); } });
        });
      } catch (error) {
        console.error(error);
        list.innerHTML = `<div class="empty-state"><div class="icon">${icon('alert',36)}</div><div>Не удалось загрузить комментарии.</div></div>`;
      }
    }

    async function sendComment() {
      const user = await requireAuth('оставить комментарий'); if (!user) return;
      const input = document.getElementById('commentInput'); const text = input.value.trim(); if (!text) return;
      const moderation=moderateCommentText(text);
      if(!moderation.allowed){ showToast(moderationMessage(moderation.reason)); return; }
      try {
        const { error } = await db.from('comments').insert({ user_id:user.id, video_id:currentCommentsVideoId, text, content:text, comment_type:'text' });
        if (error) throw error;
        input.value = ''; await openComments(currentCommentsVideoId);
        const v=videos.find(x=>x.id===currentCommentsVideoId); if(v){v.comments++; if(v.remote) await refreshVideo(v.id);}
        const card=document.querySelector(`.video-card[data-id="${CSS.escape(currentCommentsVideoId)}"]`); if(card) card.querySelector('.comment-btn .count').textContent=formatCount(v?.comments||0);
      } catch (error) {
        console.error(error);
        const message=String(error?.message||'');
        if(message.includes('COMMENT_MODERATION')) showToast('Комментарий не опубликован: обнаружена запрещённая формулировка.');
        else if(message.includes('COMMENTS_DISABLED')) showToast('Автор запретил комментарии к этому видео.');
        else if(message.includes('FOLLOW_REQUIRED')) showToast('Комментировать это видео могут только подписчики автора.');
        else showToast('Не удалось отправить комментарий.');
      }
    }

    // ========== INIT ==========
    async function init() {
      hydrateIcons();
      setupNavigationHistory();
      setupBottomNav();
      setupTopTabs();
      setupRecord();
      setupInbox();
      setupSearch();
      setupModals();
      setupConnections();
      setupSettings();
      setupFeedRefresh();
      setupDonationRealtime();
      setupInboxRealtime();
      handleDonationAlertsReturn();
      document.getElementById('dbStatus').style.display = 'block';

      try {
        await handleAuthCallback();
        await refreshAuthState();
        await loadRemoteData();
      } catch (e) {
        console.error('Init error:', e);
        generateDemoVideos();
        renderFeed();
        setDbStatus('Supabase · резервный режим');
      }
    }

    db.auth.onAuthStateChange((_event, session) => {
      authUser = session?.user || null;
      if (_event === 'PASSWORD_RECOVERY' && session?.user) {
        setTimeout(() => {
          recoveryVerified = true;
          openPasswordResetModal(session.user.email || '');
          recoveryVerified = true;
          setPasswordRecoveryStep(3);
        }, 0);
      }
      setTimeout(async () => {
        try {
          await refreshAuthState();
          await loadRemoteData();
        } catch (e) { console.warn('auth state reload', e); }
      }, 0);
    });

    init();
