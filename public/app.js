/**
 * PULSE AUDIO // Spotify-Grade 3-Column Vinyl Player Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // APPLICATION STATE & PERSISTENCE
  // =========================================================================

  const state = {
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 'off', // 'off' | 'all' | 'one'
    volume: 0.85,
    isMuted: false,
    playbackSpeed: 1.0,
    activePlaylistKey: '⭐ My Favorites',
    activePlaylistTracks: [],
    customPlaylists: {},
    trackPendingAddToPlaylist: null,
    searchDebounceTimer: null,
    isSearching: false,
    savedTime: 0,
    queueSource: null,       // e.g. 'My Favorites'
    queueContextTarget: null, // track index for context menu
    searchFilter: 'songs'    // 'songs' | 'videos' | 'albums' | 'artists' | null
  };

  // DOM Elements
  const audio = document.getElementById('nativeAudio');
  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');

  // Column 1: Disc & Controls
  const vinylDisc = document.getElementById('vinylDisc');
  const tonearm = document.getElementById('tonearm');
  const vinylCoverImg = document.getElementById('vinylCoverImg');
  const btnAddToPlaylistDisk = document.getElementById('btnAddToPlaylistDisk');
  const btnToggleLyrics = document.getElementById('btnToggleLyrics');
  const btnToggleQueue = document.getElementById('btnToggleQueue');
  const queueBadgeCountDisk = document.getElementById('queueBadgeCountDisk');

  const songTitle = document.getElementById('songTitle');
  const songArtist = document.getElementById('songArtist');
  const songAlbum = document.getElementById('songAlbum');
  const songFormat = document.getElementById('songFormat');

  const progressContainer = document.getElementById('progressContainer');
  const progressFill = document.getElementById('progressFill');
  const progressBuffer = document.getElementById('progressBuffer');
  const progressHoverTime = document.getElementById('progressHoverTime');
  const timeCurrent = document.getElementById('timeCurrent');
  const timeTotal = document.getElementById('timeTotal');

  const btnPlay = document.getElementById('btnPlay');
  const iconPlay = document.getElementById('iconPlay');
  const iconPause = document.getElementById('iconPause');
  const playSpinner = document.getElementById('playSpinner');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const btnRepeat = document.getElementById('btnRepeat');
  const repeatIndicator = document.getElementById('repeatIndicator');
  const btnSpeed = document.getElementById('btnSpeed');
  const btnMute = document.getElementById('btnMute');
  const iconVolHigh = document.getElementById('iconVolHigh');
  const iconVolMuted = document.getElementById('iconVolMuted');
  const volumeSlider = document.getElementById('volumeSlider');

  // Column 2: Middle Switchable Views
  const viewLyrics = document.getElementById('viewLyrics');
  const viewQueue = document.getElementById('viewQueue');
  const queueList = document.getElementById('queueList');
  const queueBadgeCount = document.getElementById('queueBadgeCount');
  const btnClearQueue = document.getElementById('btnClearQueue');

  // Column 3: Playlist Area
  const searchBanner = document.getElementById('searchBanner');
  const searchBannerTitle = document.getElementById('searchBannerTitle');
  const btnBackToPlaylist = document.getElementById('btnBackToPlaylist');
  const playlistTopControls = document.getElementById('playlistTopControls');
  const playlistSelect = document.getElementById('playlistSelect');
  const btnOpenCreatePlaylistModal = document.getElementById('btnOpenCreatePlaylistModal');
  const playlistMetaBar = document.getElementById('playlistMetaBar');
  const btnPlayPlaylist = document.getElementById('btnPlayPlaylist');
  const btnShufflePlaylist = document.getElementById('btnShufflePlaylist');
  const playlistTrackCount = document.getElementById('playlistTrackCount');
  const btnDeleteCustomPlaylist = document.getElementById('btnDeleteCustomPlaylist');
  const playlistTracksContainer = document.getElementById('playlistTracksContainer');

  // Modals & Toast
  const toastNotification = document.getElementById('toastNotification');
  const addToPlaylistModal = document.getElementById('addToPlaylistModal');
  const btnCloseAddToPlaylist = document.getElementById('btnCloseAddToPlaylist');
  const playlistTargetList = document.getElementById('playlistTargetList');
  const quickNewPlaylistInput = document.getElementById('quickNewPlaylistInput');
  const btnQuickCreateAndAdd = document.getElementById('btnQuickCreateAndAdd');

  const createPlaylistModal = document.getElementById('createPlaylistModal');
  const btnCloseCreatePlaylist = document.getElementById('btnCloseCreatePlaylist');
  const btnCancelCreatePlaylist = document.getElementById('btnCancelCreatePlaylist');
  const btnConfirmCreatePlaylist = document.getElementById('btnConfirmCreatePlaylist');
  const newPlaylistNameInput = document.getElementById('newPlaylistNameInput');

  // Save Queue Modal
  const saveQueueModal = document.getElementById('saveQueueModal');
  const btnCloseSaveQueueModal = document.getElementById('btnCloseSaveQueueModal');
  const btnCancelSaveQueueModal = document.getElementById('btnCancelSaveQueueModal');
  const btnConfirmSaveQueueModal = document.getElementById('btnConfirmSaveQueueModal');
  const saveQueueNameInput = document.getElementById('saveQueueNameInput');
  const saveQueueModalSubtitle = document.getElementById('saveQueueModalSubtitle');

  // Confirm Delete Modal
  const confirmDeleteModal = document.getElementById('confirmDeleteModal');
  const btnCloseDeleteModal = document.getElementById('btnCloseDeleteModal');
  const btnCancelDeleteModal = document.getElementById('btnCancelDeleteModal');
  const btnConfirmDeleteModal = document.getElementById('btnConfirmDeleteModal');
  const confirmDeleteMessage = document.getElementById('confirmDeleteMessage');

  // Search Filter Chips
  const searchFilterChips = document.getElementById('searchFilterChips');

  const eqModal = document.getElementById('eqModal');
  const btnEqToggle = document.getElementById('btnEqToggle');
  const btnCloseEq = document.getElementById('btnCloseEq');
  const eqBass = document.getElementById('eqBass');
  const eqMid = document.getElementById('eqMid');
  const eqTreble = document.getElementById('eqTreble');
  const eqBassVal = document.getElementById('eqBassVal');
  const eqMidVal = document.getElementById('eqMidVal');
  const eqTrebleVal = document.getElementById('eqTrebleVal');
  const eqPresetBtns = document.querySelectorAll('.eq-preset-btn');

  // Engines
  const visualizer = new AudioVisualizer();
  const lyricsManager = new LyricsManager();

  lyricsManager.setSeekCallback((timestamp) => {
    if (audio.duration) {
      audio.currentTime = timestamp;
      if (audio.paused) playAudio();
    }
  });

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function showToast(msg) {
    if (!toastNotification) return;
    toastNotification.textContent = msg;
    toastNotification.classList.remove('hidden');
    clearTimeout(toastNotification._timer);
    toastNotification._timer = setTimeout(() => {
      toastNotification.classList.add('hidden');
    }, 2400);
  }

  // =========================================================================
  // LOCALSTORAGE PLAYLIST MANAGEMENT
  // =========================================================================

  function loadPlaylistsFromStorage() {
    try {
      const stored = localStorage.getItem('pulse_custom_playlists');
      if (stored) {
        state.customPlaylists = JSON.parse(stored);
      } else {
        // Start with a clean custom playlist
        state.customPlaylists = {
          "⭐ My Favorites": []
        };
        savePlaylistsToStorage();
      }
    } catch (e) {
      console.warn("Storage read error:", e);
      state.customPlaylists = { "⭐ My Favorites": [] };
    }
  }

  function savePlaylistsToStorage() {
    try {
      localStorage.setItem('pulse_custom_playlists', JSON.stringify(state.customPlaylists));
    } catch (e) {
      console.warn("Storage save error:", e);
    }
  }

  function renderPlaylistSelectDropdown() {
    playlistSelect.innerHTML = '';
    const names = Object.keys(state.customPlaylists);

    if (names.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No playlists yet';
      playlistSelect.appendChild(opt);
      return;
    }

    names.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      const count = state.customPlaylists[name] ? state.customPlaylists[name].length : 0;
      opt.textContent = `📁 ${name} (${count})`;
      if (name === state.activePlaylistKey) opt.selected = true;
      playlistSelect.appendChild(opt);
    });

    if (!names.includes(state.activePlaylistKey)) {
      state.activePlaylistKey = names[0];
      playlistSelect.value = names[0];
    }
  }

  function createNewCustomPlaylist(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!state.customPlaylists[trimmed]) {
      state.customPlaylists[trimmed] = [];
      savePlaylistsToStorage();
      renderPlaylistSelectDropdown();
      showToast(`Created playlist "${trimmed}"`);
    }
    state.activePlaylistKey = trimmed;
    playlistSelect.value = trimmed;
    loadPlaylist(trimmed);
    createPlaylistModal.classList.add('hidden');
  }

  let playlistPendingDelete = null;

  function promptDeleteCurrentPlaylist() {
    const name = state.activePlaylistKey;
    if (!name || !state.customPlaylists[name]) {
      showToast('No custom playlist selected to delete');
      return;
    }
    playlistPendingDelete = name;
    if (confirmDeleteMessage) {
      confirmDeleteMessage.textContent = `Are you sure you want to delete "${name}"? All tracks in this playlist will be removed.`;
    }
    if (confirmDeleteModal) {
      confirmDeleteModal.classList.remove('hidden');
    }
  }

  function executeDeletePlaylist() {
    const name = playlistPendingDelete;
    if (confirmDeleteModal) confirmDeleteModal.classList.add('hidden');
    if (!name || !state.customPlaylists[name]) return;
    delete state.customPlaylists[name];
    savePlaylistsToStorage();
    const remaining = Object.keys(state.customPlaylists);
    if (remaining.length === 0) {
      state.customPlaylists['⭐ My Favorites'] = [];
      savePlaylistsToStorage();
      state.activePlaylistKey = '⭐ My Favorites';
    } else {
      state.activePlaylistKey = remaining[0];
    }
    renderPlaylistSelectDropdown();
    loadPlaylist(state.activePlaylistKey);
    showToast(`Deleted playlist "${name}"`);
    playlistPendingDelete = null;
  }

  function addTrackToPlaylist(playlistName, track) {
    if (!state.customPlaylists[playlistName]) state.customPlaylists[playlistName] = [];
    const list = state.customPlaylists[playlistName];
    if (list.some(t => t.id === track.id)) {
      showToast(`"${track.title}" is already in "${playlistName}"`);
      return;
    }
    list.push(track);
    savePlaylistsToStorage();
    renderPlaylistSelectDropdown();

    if (state.activePlaylistKey === playlistName && !state.isSearching) {
      loadPlaylist(playlistName);
    }
    showToast(`Added to "${playlistName}"`);
  }

  function removeTrackFromPlaylist(playlistName, trackId) {
    if (!state.customPlaylists[playlistName]) return;
    state.customPlaylists[playlistName] = state.customPlaylists[playlistName].filter(t => t.id !== trackId);
    savePlaylistsToStorage();
    renderPlaylistSelectDropdown();
    loadPlaylist(playlistName);
    showToast("Removed track from playlist");
  }

  // =========================================================================
  // PERSISTENCE OF MUSIC & PLAYBACK POSITION
  // =========================================================================

  function savePlaybackState() {
    if (!state.currentTrack) return;
    try {
      const payload = {
        track: state.currentTrack,
        currentTime: audio.currentTime || 0,
        queue: state.queue,
        queueIndex: state.queueIndex,
        activePlaylistKey: state.activePlaylistKey,
        volume: state.volume,
        playbackSpeed: state.playbackSpeed,
        repeatMode: state.repeatMode
      };
      localStorage.setItem('pulse_playback_state', JSON.stringify(payload));
    } catch (e) {
      console.warn("Failed to persist playback state:", e);
    }
  }

  function restorePlaybackState() {
    try {
      const stored = localStorage.getItem('pulse_playback_state');
      if (!stored) return false;
      const data = JSON.parse(stored);
      if (!data || !data.track) return false;

      state.currentTrack = data.track;
      state.savedTime = data.currentTime || 0;
      state.queue = Array.isArray(data.queue) ? data.queue : [data.track];
      state.queueIndex = (typeof data.queueIndex === 'number' && data.queueIndex >= 0) ? data.queueIndex : 0;
      if (data.activePlaylistKey && state.customPlaylists[data.activePlaylistKey]) {
        state.activePlaylistKey = data.activePlaylistKey;
        if (playlistSelect) playlistSelect.value = state.activePlaylistKey;
      }
      if (typeof data.volume === 'number') {
        state.volume = data.volume;
        audio.volume = state.volume;
        volumeSlider.value = state.volume;
      }

      // Update UI for the restored song
      updateTrackMetadataUI(state.currentTrack);
      updateQueueUI();

      // Preload audio and seek to the saved time without autoplay
      audio.src = `/api/proxy/${state.currentTrack.id}`;
      audio.currentTime = state.savedTime;
      timeCurrent.textContent = formatTime(state.savedTime);
      if (state.currentTrack.durationSeconds) {
        timeTotal.textContent = formatTime(state.currentTrack.durationSeconds);
        progressFill.style.width = `${(state.savedTime / state.currentTrack.durationSeconds) * 100}%`;
      }

      // Fetch lyrics in background so they are ready
      lyricsManager.load(state.currentTrack.title, state.currentTrack.artist, state.currentTrack.durationSeconds || 0);

      return true;
    } catch (e) {
      console.warn("Could not restore playback state:", e);
      return false;
    }
  }

  // Periodic persistence on playback
  let lastSaveTime = 0;
  audio.addEventListener('timeupdate', () => {
    const cur = audio.currentTime;
    const dur = audio.duration;

    if (!isNaN(dur) && dur > 0) {
      const pct = (cur / dur) * 100;
      progressFill.style.width = `${pct}%`;
      timeCurrent.textContent = formatTime(cur);
      timeTotal.textContent = formatTime(dur);
    } else {
      timeCurrent.textContent = formatTime(cur);
    }

    lyricsManager.updateTime(cur);

    // Save every 3 seconds
    const now = Date.now();
    if (now - lastSaveTime > 3000) {
      lastSaveTime = now;
      savePlaybackState();
    }
  });

  window.addEventListener('beforeunload', savePlaybackState);

  // =========================================================================
  // MIDDLE COLUMN SWITCHER (LYRICS VS QUEUE)
  // =========================================================================

  function showMiddleView(viewName) {
    if (viewName === 'lyrics') {
      btnToggleLyrics.classList.add('active');
      btnToggleQueue.classList.remove('active');
      viewLyrics.classList.add('active');
      viewQueue.classList.remove('active');
    } else {
      btnToggleLyrics.classList.remove('active');
      btnToggleQueue.classList.add('active');
      viewLyrics.classList.remove('active');
      viewQueue.classList.add('active');
    }
  }

  btnToggleLyrics.addEventListener('click', () => showMiddleView('lyrics'));
  btnToggleQueue.addEventListener('click', () => showMiddleView('queue'));

  // =========================================================================
  // PLAYLIST RENDERING & PLAYLIST AS QUEUE
  // =========================================================================

  function loadPlaylist(name) {
    state.isSearching = false;
    searchBanner.classList.add('hidden');
    if (searchFilterChips) searchFilterChips.classList.add('hidden');
    playlistTopControls.classList.remove('hidden');
    playlistMetaBar.classList.remove('hidden');

    state.activePlaylistKey = name;
    const tracks = state.customPlaylists[name] || [];
    state.activePlaylistTracks = tracks;

    playlistTrackCount.textContent = `${tracks.length} tracks`;
    btnDeleteCustomPlaylist.classList.toggle('hidden', !name);

    renderTrackList(tracks, false);
  }

  async function loadAlbum(browseId, title) {
    state.isSearching = true;
    searchBanner.classList.remove('hidden');
    searchBannerTitle.textContent = `Album: ${title}`;
    if (searchFilterChips) searchFilterChips.classList.add('hidden');
    playlistTopControls.classList.add('hidden');
    playlistMetaBar.classList.add('hidden');
    playlistTracksContainer.innerHTML = `<div style="text-align:center;padding:50px 10px;color:var(--text-muted);font-size:13px;">Loading album tracks...</div>`;

    try {
      const res = await fetch(`/api/album/${encodeURIComponent(browseId)}`);
      if (!res.ok) throw new Error("Failed to load album");
      const data = await res.json();
      searchBannerTitle.textContent = `${data.title} (${data.artist})`;
      renderTrackList(data.tracks || [], true);
    } catch (e) {
      console.error(e);
      playlistTracksContainer.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">Failed to load album tracks.</div>`;
    }
  }

  async function loadArtist(browseId, name) {
    state.isSearching = true;
    searchBanner.classList.remove('hidden');
    searchBannerTitle.textContent = `Artist: ${name}`;
    if (searchFilterChips) searchFilterChips.classList.add('hidden');
    playlistTopControls.classList.add('hidden');
    playlistMetaBar.classList.add('hidden');
    playlistTracksContainer.innerHTML = `<div style="text-align:center;padding:50px 10px;color:var(--text-muted);font-size:13px;">Loading artist top songs...</div>`;

    try {
      const res = await fetch(`/api/artist/${encodeURIComponent(browseId)}`);
      if (!res.ok) throw new Error("Failed to load artist");
      const data = await res.json();
      searchBannerTitle.textContent = `Top Songs by ${data.artist}`;
      renderTrackList(data.tracks || [], true);
    } catch (e) {
      console.error(e);
      playlistTracksContainer.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">Failed to load artist songs.</div>`;
    }
  }

  function renderTrackList(tracks, isSearchResult = false) {
    playlistTracksContainer.innerHTML = '';

    if (tracks.length === 0) {
      if (isSearchResult) {
        playlistTracksContainer.innerHTML = `
          <div style="text-align:center;padding:60px 10px;color:var(--text-muted);font-size:13px;">
            No songs found. Try a different search query or filter!
          </div>
        `;
      } else {
        playlistTracksContainer.innerHTML = `
          <div style="text-align:center;padding:60px 10px;color:var(--text-muted);font-size:13px;">
            This playlist is empty.<br>
            Use the search box above to find songs and click <b>+ Playlist</b> to add them here!
          </div>
        `;
      }
      return;
    }

    tracks.forEach((track, idx) => {
      const row = document.createElement('div');
      row.className = 'track-row';
      if (state.currentTrack && state.currentTrack.id === track.id) {
        row.classList.add('playing');
      }

      const defaultThumb = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=120&auto=format&fit=crop&q=80';
      const thumb = track.thumbnail || defaultThumb;

      // Handle Album cards
      if (track.type === 'album') {
        row.classList.add('album-card');
        row.innerHTML = `
          <span class="track-row-num">${idx + 1}</span>
          <div class="track-row-thumb-wrap">
            <img src="${thumb}" alt="${track.title}" class="track-row-thumb" loading="lazy" onerror="this.src='${defaultThumb}'">
            <div class="track-row-play-overlay">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3"></polygon>
              </svg>
            </div>
          </div>
          <div class="track-row-info">
            <div class="track-row-title" title="${track.title}">
              ${track.title}
              <span class="badge-album">Album</span>
            </div>
            <div class="track-row-artist" title="${track.artist}">${track.artist}</div>
          </div>
          <div class="track-row-album">${track.album || 'Album'}</div>
          <div class="track-row-duration" style="font-size:11px;color:var(--accent-pink);font-weight:600;">View Album →</div>
        `;
        row.addEventListener('click', () => {
          loadAlbum(track.browseId || track.id, track.title);
        });
        playlistTracksContainer.appendChild(row);
        return;
      }

      // Handle Artist cards
      if (track.type === 'artist') {
        row.classList.add('artist-card');
        row.innerHTML = `
          <span class="track-row-num">${idx + 1}</span>
          <div class="track-row-thumb-wrap">
            <img src="${thumb}" alt="${track.title}" class="track-row-thumb" loading="lazy" onerror="this.src='${defaultThumb}'">
            <div class="track-row-play-overlay">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3"></polygon>
              </svg>
            </div>
          </div>
          <div class="track-row-info">
            <div class="track-row-title" title="${track.title}">
              ${track.title}
              <span class="badge-artist">Artist</span>
            </div>
            <div class="track-row-artist">Verified Artist</div>
          </div>
          <div class="track-row-album">Artist Profile</div>
          <div class="track-row-duration" style="font-size:11px;color:var(--accent-purple);font-weight:600;">Top Tracks →</div>
        `;
        row.addEventListener('click', () => {
          loadArtist(track.browseId || track.id, track.title);
        });
        playlistTracksContainer.appendChild(row);
        return;
      }

      // Standard Song / Video
      const typeBadge = track.type === 'video' ? '<span class="badge-video">Video</span>' : '';

      row.innerHTML = `
        <span class="track-row-num">${idx + 1}</span>
        <div class="track-row-thumb-wrap">
          <img src="${thumb}" alt="${track.title}" class="track-row-thumb" loading="lazy" onerror="this.src='${defaultThumb}'">
          <div class="track-row-play-overlay">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <polygon points="6 3 20 12 6 21 6 3"></polygon>
            </svg>
          </div>
        </div>
        <div class="track-row-info">
          <div class="track-row-title" title="${track.title}">
            ${track.title}
            ${typeBadge}
          </div>
          <div class="track-row-artist" title="${track.artist}">${track.artist}</div>
        </div>
        <div class="track-row-album" title="${track.album || ''}">${track.album || ''}</div>
        <div class="track-row-duration">${track.duration || 'HQ'}</div>
        <div class="track-row-actions">
          <button class="track-action-btn btn-add-q" title="Add to Queue">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button class="track-action-btn btn-add-pl" title="Add to Playlist">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
          ${!isSearchResult ? `
            <button class="track-action-btn btn-remove-pl" title="Remove from playlist" style="color:var(--accent-pink);">
              ✕
            </button>
          ` : ''}
        </div>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-add-q')) {
          e.stopPropagation();
          addToQueue(track);
          showToast(`Added "${track.title}" to Queue`);
          return;
        }
        if (e.target.closest('.btn-add-pl')) {
          e.stopPropagation();
          openAddToPlaylistModal(track);
          return;
        }
        if (e.target.closest('.btn-remove-pl')) {
          e.stopPropagation();
          removeTrackFromPlaylist(state.activePlaylistKey, track.id);
          return;
        }

        // KEY REQUIREMENT: When playing a song from playlist, WHOLE playlist becomes the queue!
        if (!isSearchResult && tracks.length > 0) {
          state.queue = [...tracks];
          state.queueIndex = idx;
          setQueueSource(state.activePlaylistKey);
          updateQueueUI();
          playTrack(state.queue[state.queueIndex]);
        } else {
          // If playing from search results, add to current queue or play directly
          const existingIdx = state.queue.findIndex(t => t.id === track.id);
          if (existingIdx !== -1) {
            state.queueIndex = existingIdx;
          } else {
            state.queue.push(track);
            state.queueIndex = state.queue.length - 1;
          }
          setQueueSource('Search Results');
          updateQueueUI();
          playTrack(track);
        }
      });

      playlistTracksContainer.appendChild(row);
    });
  }

  // =========================================================================
  // PLAY PLAYLIST & RANDOMIZER BUTTONS
  // =========================================================================

  btnPlayPlaylist.addEventListener('click', () => {
    const tracks = state.activePlaylistTracks;
    if (!tracks || tracks.length === 0) {
      showToast("Playlist is empty! Add songs first.");
      return;
    }
    // Set whole playlist as queue and play from start
    state.queue = [...tracks];
    state.queueIndex = 0;
    setQueueSource(state.activePlaylistKey);
    updateQueueUI();
    playTrack(state.queue[0]);
    showToast(`Playing playlist "${state.activePlaylistKey}"`);
  });

  btnShufflePlaylist.addEventListener('click', () => {
    const tracks = state.activePlaylistTracks;
    if (!tracks || tracks.length === 0) {
      showToast("Playlist is empty! Add songs first.");
      return;
    }
    // Fisher-Yates Shuffle
    const shuffled = [...tracks];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    state.queue = shuffled;
    state.queueIndex = 0;
    setQueueSource(`${state.activePlaylistKey} (Shuffled)`);
    updateQueueUI();
    playTrack(state.queue[0]);
    showToast(`Randomized & playing "${state.activePlaylistKey}"`);
  });

  // =========================================================================
  // SEARCH & "BACK TO PLAYLIST"
  // =========================================================================

  async function performSearch(query, filter) {
    const trimmed = query.trim();
    if (!trimmed) {
      loadPlaylist(state.activePlaylistKey);
      return;
    }

    const activeFilter = filter !== undefined ? filter : state.searchFilter;
    state.isSearching = true;
    searchBanner.classList.remove('hidden');
    if (searchFilterChips) searchFilterChips.classList.remove('hidden');
    searchBannerTitle.textContent = `Search results for "${trimmed}"`;
    playlistTopControls.classList.add('hidden');
    playlistMetaBar.classList.add('hidden');

    playlistTracksContainer.innerHTML = `
      <div style="text-align:center;padding:50px 10px;color:var(--text-muted);font-size:13px;">
        Searching YouTube Music...
      </div>
    `;

    try {
      const filterParam = activeFilter ? `&filter=${encodeURIComponent(activeFilter)}` : '';
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}${filterParam}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      renderTrackList(data.results || [], true);
    } catch (e) {
      console.error(e);
      playlistTracksContainer.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">Search failed.</div>`;
    }
  }

  // Filter chips click handling
  if (searchFilterChips) {
    searchFilterChips.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        searchFilterChips.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.searchFilter = chip.dataset.filter || '';
        if (searchInput.value.trim()) {
          performSearch(searchInput.value, state.searchFilter);
        }
      });
    });
  }

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    searchClearBtn.style.display = val ? 'block' : 'none';
    clearTimeout(state.searchDebounceTimer);
    state.searchDebounceTimer = setTimeout(() => {
      performSearch(val);
    }, 400);
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.style.display = 'none';
    loadPlaylist(state.activePlaylistKey);
  });

  btnBackToPlaylist.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.style.display = 'none';
    loadPlaylist(state.activePlaylistKey);
  });

  // Playlist dropdown switch
  playlistSelect.addEventListener('change', (e) => {
    loadPlaylist(e.target.value);
  });

  // =========================================================================
  // QUEUE MANAGEMENT
  // =========================================================================

  function addToQueue(track, insertAfterCurrent = false) {
    if (insertAfterCurrent && state.queueIndex >= 0) {
      // Insert immediately after current track (Play Next)
      state.queue.splice(state.queueIndex + 1, 0, track);
    } else {
      state.queue.push(track);
    }
    updateQueueUI();
  }

  function setQueueSource(sourceName) {
    state.queueSource = sourceName;
    const el = document.getElementById('queueContextText');
    if (el) el.textContent = `Playing from: ${sourceName}`;
  }

  function updateQueueUI() {
    const total = state.queue.length;
    const upcomingCount = Math.max(0, total - state.queueIndex - 1);
    // Update badges - show upcoming count, not total
    const queueBadgeCount = document.getElementById('queueBadgeCount');
    if (queueBadgeCount) queueBadgeCount.textContent = upcomingCount;
    if (queueBadgeCountDisk) queueBadgeCountDisk.textContent = upcomingCount;

    // ── NOW PLAYING section ──
    const nowPlayingEl = document.getElementById('queueNowPlaying');
    if (nowPlayingEl) {
      const cur = state.currentTrack;
      if (cur) {
        const defaultThumb = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=120&auto=format&fit=crop&q=80';
        const isPlaying = state.isPlaying;
        nowPlayingEl.innerHTML = `
          <div class="queue-now-item">
            <div class="queue-now-thumb-wrap">
              <img src="${cur.thumbnail || defaultThumb}" alt="" class="queue-now-thumb" onerror="this.src='${defaultThumb}'">
              <div class="queue-now-eq-bars${isPlaying ? '' : ' paused'}">
                <span></span><span></span><span></span><span></span>
              </div>
            </div>
            <div class="queue-now-meta">
              <div class="queue-now-title" title="${cur.title}">${cur.title}</div>
              <div class="queue-now-artist" title="${cur.artist}">${cur.artist}</div>
            </div>
            <div class="queue-now-duration">${cur.duration || ''}</div>
          </div>
        `;
      } else {
        nowPlayingEl.innerHTML = '<div class="queue-empty">Nothing playing yet</div>';
      }
    }

    // ── NEXT UP section ──
    const queueList = document.getElementById('queueList');
    const nextCountEl = document.getElementById('queueNextCount');

    // Upcoming = everything after queueIndex
    const upcoming = state.queue.slice(state.queueIndex + 1);
    const upcomingStartIdx = state.queueIndex + 1;

    if (nextCountEl) nextCountEl.textContent = upcoming.length > 0 ? `· ${upcoming.length}` : '';

    if (!queueList) return;
    queueList.innerHTML = '';

    if (upcoming.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'queue-empty';
      if (total === 0) {
        emptyDiv.innerHTML = 'Queue is empty.<br>Play a playlist or add tracks from search!';
      } else {
        emptyDiv.innerHTML = 'No more tracks.<br><span style="color:var(--text-muted)">End of queue</span>';
      }
      queueList.appendChild(emptyDiv);
      return;
    }

    upcoming.forEach((track, relIdx) => {
      const absoluteIdx = upcomingStartIdx + relIdx;
      const card = createQueueCard(track, absoluteIdx, relIdx + 1);
      queueList.appendChild(card);
    });
  }

  function createQueueCard(track, absoluteIdx, displayNum) {
    const defaultThumb = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=120&auto=format&fit=crop&q=80';
    const card = document.createElement('div');
    card.className = 'queue-card';
    card.dataset.idx = absoluteIdx;
    card.draggable = true;

    card.innerHTML = `
      <span class="queue-card-num">${displayNum}</span>
      <div class="queue-drag-handle" title="Drag to reorder">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="16" y2="6"></line>
          <line x1="8" y1="12" x2="16" y2="12"></line>
          <line x1="8" y1="18" x2="16" y2="18"></line>
        </svg>
      </div>
      <div class="queue-thumb-wrap">
        <img src="${track.thumbnail || defaultThumb}" alt="" class="queue-thumb" onerror="this.src='${defaultThumb}'">
        <div class="queue-thumb-play-overlay">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
        </div>
      </div>
      <div class="queue-meta">
        <div class="queue-title" title="${track.title}">${track.title}</div>
        <div class="queue-artist" title="${track.artist}">${track.artist}</div>
      </div>
      <div class="queue-duration">${track.duration || ''}</div>
      <div class="queue-item-actions">
        <button class="queue-action-btn" title="More options" data-action="menu">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </button>
        <button class="queue-action-btn danger" title="Remove from queue" data-action="remove">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;

    // Click on card = play that track
    card.addEventListener('click', (e) => {
      if (e.target.closest('.queue-action-btn') || e.target.closest('.queue-drag-handle')) return;
      state.queueIndex = absoluteIdx;
      updateQueueUI();
      playTrack(state.queue[absoluteIdx]);
    });

    // Action buttons
    card.addEventListener('click', (e) => {
      const btn = e.target.closest('.queue-action-btn');
      if (!btn) return;
      e.stopPropagation();
      if (btn.dataset.action === 'remove') {
        removeFromQueue(absoluteIdx);
      } else if (btn.dataset.action === 'menu') {
        openQueueContextMenu(e, absoluteIdx);
      }
    });

    // Right-click context menu
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openQueueContextMenu(e, absoluteIdx);
    });

    // Drag-to-reorder
    setupQueueDragEvents(card, absoluteIdx);

    return card;
  }

  // ── DRAG TO REORDER ──
  let dragSrcIdx = null;

  function setupQueueDragEvents(card, idx) {
    card.addEventListener('dragstart', (e) => {
      dragSrcIdx = idx;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.queue-card').forEach(c => c.classList.remove('drag-over'));
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragSrcIdx !== idx) card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      if (dragSrcIdx === null || dragSrcIdx === idx) return;

      const src = state.queue[dragSrcIdx];
      state.queue.splice(dragSrcIdx, 1);
      // After removal, find where the drop target ended up
      const targetIdx = idx > dragSrcIdx ? idx - 1 : idx;
      state.queue.splice(targetIdx, 0, src);

      // Adjust queueIndex
      if (state.queueIndex === dragSrcIdx) {
        state.queueIndex = targetIdx;
      } else if (dragSrcIdx < state.queueIndex && targetIdx >= state.queueIndex) {
        state.queueIndex--;
      } else if (dragSrcIdx > state.queueIndex && targetIdx <= state.queueIndex) {
        state.queueIndex++;
      }

      dragSrcIdx = null;
      updateQueueUI();
      showToast('Queue reordered');
    });
  }

  // ── CONTEXT MENU ──
  const queueContextMenu = document.getElementById('queueContextMenu');
  let ctxTargetIdx = null;

  function openQueueContextMenu(e, idx) {
    ctxTargetIdx = idx;
    queueContextMenu.classList.remove('hidden');

    // Position the menu near click, stay on screen
    let x = e.clientX, y = e.clientY;
    const menuW = 200, menuH = 200;
    if (x + menuW > window.innerWidth) x = window.innerWidth - menuW - 8;
    if (y + menuH > window.innerHeight) y = window.innerHeight - menuH - 8;
    queueContextMenu.style.left = x + 'px';
    queueContextMenu.style.top = y + 'px';
  }

  function closeQueueContextMenu() {
    queueContextMenu.classList.add('hidden');
    ctxTargetIdx = null;
  }

  document.addEventListener('click', (e) => {
    if (!queueContextMenu.classList.contains('hidden') && !queueContextMenu.contains(e.target)) {
      closeQueueContextMenu();
    }
  });

  document.getElementById('ctxPlayNow')?.addEventListener('click', () => {
    if (ctxTargetIdx !== null) {
      state.queueIndex = ctxTargetIdx;
      updateQueueUI();
      playTrack(state.queue[ctxTargetIdx]);
    }
    closeQueueContextMenu();
  });

  document.getElementById('ctxPlayNext')?.addEventListener('click', () => {
    if (ctxTargetIdx !== null && ctxTargetIdx !== state.queueIndex + 1) {
      const track = state.queue.splice(ctxTargetIdx, 1)[0];
      const insertAt = state.queueIndex + 1;
      state.queue.splice(insertAt, 0, track);
      updateQueueUI();
      showToast(`"${track.title}" will play next`);
    }
    closeQueueContextMenu();
  });

  document.getElementById('ctxMoveToTop')?.addEventListener('click', () => {
    if (ctxTargetIdx !== null) {
      const track = state.queue.splice(ctxTargetIdx, 1)[0];
      const insertAt = state.queueIndex + 1;
      state.queue.splice(insertAt, 0, track);
      updateQueueUI();
      showToast(`Moved "${track.title}" to top`);
    }
    closeQueueContextMenu();
  });

  document.getElementById('ctxAddToPlaylist')?.addEventListener('click', () => {
    if (ctxTargetIdx !== null) {
      openAddToPlaylistModal(state.queue[ctxTargetIdx]);
    }
    closeQueueContextMenu();
  });

  document.getElementById('ctxRemoveFromQueue')?.addEventListener('click', () => {
    if (ctxTargetIdx !== null) removeFromQueue(ctxTargetIdx);
    closeQueueContextMenu();
  });

  function removeFromQueue(idx) {
    if (idx < 0 || idx >= state.queue.length) return;
    const track = state.queue[idx];
    state.queue.splice(idx, 1);
    if (state.queueIndex >= idx && state.queueIndex > 0) state.queueIndex--;
    updateQueueUI();
    showToast(`Removed "${track.title}"`);
  }

  // Save Queue as Playlist using Modal
  function openSaveQueueModal() {
    if (state.queue.length === 0) {
      showToast('Queue is empty! Add songs to queue first.');
      return;
    }
    const count = state.queue.length;
    if (saveQueueModalSubtitle) {
      saveQueueModalSubtitle.textContent = `Save ${count} track${count === 1 ? '' : 's'} currently in queue to a new playlist`;
    }
    if (saveQueueNameInput) {
      const dateStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      saveQueueNameInput.value = `Queue Mix (${dateStr})`;
    }
    if (saveQueueModal) {
      saveQueueModal.classList.remove('hidden');
      setTimeout(() => {
        saveQueueNameInput?.focus();
        saveQueueNameInput?.select();
      }, 50);
    }
  }

  function executeSaveQueueAsPlaylist() {
    if (state.queue.length === 0) {
      showToast('Queue is empty!');
      if (saveQueueModal) saveQueueModal.classList.add('hidden');
      return;
    }
    const raw = saveQueueNameInput ? saveQueueNameInput.value.trim() : '';
    if (!raw) {
      showToast('Please enter a playlist name');
      return;
    }
    if (!state.customPlaylists[raw]) {
      state.customPlaylists[raw] = [];
    }
    state.queue.forEach(t => {
      if (!state.customPlaylists[raw].some(x => x.id === t.id)) {
        state.customPlaylists[raw].push(t);
      }
    });
    savePlaylistsToStorage();
    renderPlaylistSelectDropdown();
    state.activePlaylistKey = raw;
    playlistSelect.value = raw;
    loadPlaylist(raw);
    if (saveQueueModal) saveQueueModal.classList.add('hidden');
    showToast(`Saved ${state.queue.length} tracks to "${raw}"`);
  }

  document.getElementById('btnSaveQueue')?.addEventListener('click', openSaveQueueModal);
  btnCloseSaveQueueModal?.addEventListener('click', () => saveQueueModal?.classList.add('hidden'));
  btnCancelSaveQueueModal?.addEventListener('click', () => saveQueueModal?.classList.add('hidden'));
  btnConfirmSaveQueueModal?.addEventListener('click', executeSaveQueueAsPlaylist);
  saveQueueNameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeSaveQueueAsPlaylist();
  });


  // Clear upcoming queue (keeps current track at queueIndex)
  document.getElementById('btnClearQueue')?.addEventListener('click', () => {
    if (state.queue.length === 0) { showToast('Queue is already empty'); return; }
    // Keep only up to and including current track
    state.queue = state.queue.slice(0, state.queueIndex + 1);
    updateQueueUI();
    showToast('Cleared upcoming queue');
  });

  // =========================================================================
  // AUDIO ENGINE & VINYL ROTATION
  // =========================================================================

  async function playTrack(track) {
    state.currentTrack = track;
    updateTrackMetadataUI(track);
    updateQueueUI(); // <-- refresh NOW PLAYING card immediately

    iconPlay.classList.add('hidden');
    iconPause.classList.add('hidden');
    playSpinner.classList.remove('hidden');

    // Update active row in playlist
    document.querySelectorAll('.track-row').forEach(r => r.classList.remove('playing'));
    Array.from(document.querySelectorAll('.track-row')).forEach(r => {
      if (r.querySelector('.track-row-title')?.textContent === track.title) {
        r.classList.add('playing');
      }
    });

    // Start fetching synchronized lyrics simultaneously!
    lyricsManager.load(track.title, track.artist, track.durationSeconds || 0);

    visualizer.init(audio);
    visualizer.resume();

    try {
      const streamEndpoint = `/api/proxy/${track.id}`;
      audio.src = streamEndpoint;
      audio.playbackRate = state.playbackSpeed;
      audio.volume = state.isMuted ? 0 : state.volume;

      await audio.play();
      state.isPlaying = true;
      updatePlayPauseButton(true);
      setVinylSpinning(true);
      updateQueueUI(); // refresh EQ bars to playing state
      savePlaybackState();
    } catch (err) {
      console.warn("Direct stream proxy failed, trying direct URL fetch fallback...", err);
      try {
        const streamInfoRes = await fetch(`/api/stream/${track.id}`);
        const streamInfo = await streamInfoRes.json();
        if (streamInfo.streamUrl) {
          audio.src = streamInfo.streamUrl;
          await audio.play();
          state.isPlaying = true;
          updatePlayPauseButton(true);
          setVinylSpinning(true);
          savePlaybackState();
        }
      } catch (fallbackErr) {
        console.error("Playback failed:", fallbackErr);
        playSpinner.classList.add('hidden');
        iconPlay.classList.remove('hidden');
        setVinylSpinning(false);
        playNext();
      }
    }
  }

  function playAudio() {
    visualizer.resume();
    audio.play().then(() => {
      state.isPlaying = true;
      updatePlayPauseButton(true);
      setVinylSpinning(true);
      updateQueueUI(); // refresh EQ bars
    }).catch(e => console.warn("Audio play prevented:", e));
  }

  function pauseAudio() {
    audio.pause();
    state.isPlaying = false;
    updatePlayPauseButton(false);
    setVinylSpinning(false);
    updateQueueUI(); // refresh EQ bars to paused
    savePlaybackState();
  }

  function setVinylSpinning(isSpinning) {
    if (isSpinning) {
      vinylDisc.classList.add('spinning');
      tonearm.classList.add('playing');
    } else {
      vinylDisc.classList.remove('spinning');
      tonearm.classList.remove('playing');
    }
  }

  function updatePlayPauseButton(isPlaying) {
    playSpinner.classList.add('hidden');
    if (isPlaying) {
      iconPlay.classList.add('hidden');
      iconPause.classList.remove('hidden');
    } else {
      iconPlay.classList.remove('hidden');
      iconPause.classList.add('hidden');
    }
  }

  function updateTrackMetadataUI(track) {
    songTitle.textContent = track.title || 'No Track Selected';
    songTitle.title = track.title || '';
    songArtist.textContent = track.artist || 'PULSE Audio Engine';
    songArtist.title = track.artist || '';
    songAlbum.textContent = track.album ? `Album: ${track.album}` : 'Single';
    songFormat.textContent = track.mimeType ? track.mimeType.toUpperCase() : 'HQ OPUS';

    const defaultCover = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&auto=format&fit=crop&q=80';
    vinylCoverImg.src = track.thumbnail || defaultCover;

    const ambientGlow = document.getElementById('ambientGlow');
    if (ambientGlow) {
      ambientGlow.style.background = `
        radial-gradient(circle at 18% 30%, rgba(0, 245, 212, 0.2), transparent 45%),
        radial-gradient(circle at 82% 70%, rgba(121, 40, 202, 0.24), transparent 50%)
      `;
    }
  }

  function playNext() {
    if (state.queue.length === 0) return;
    if (state.repeatMode === 'one' && state.currentTrack) {
      audio.currentTime = 0;
      playAudio();
      return;
    }

    let nextIdx = state.queueIndex + 1;
    if (nextIdx >= state.queue.length) {
      if (state.repeatMode === 'all') nextIdx = 0;
      else return;
    }
    state.queueIndex = nextIdx;
    updateQueueUI();
    playTrack(state.queue[nextIdx]);
  }

  function playPrev() {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (state.queue.length === 0) return;
    let prevIdx = state.queueIndex - 1;
    if (prevIdx < 0) prevIdx = state.queue.length - 1;
    state.queueIndex = prevIdx;
    updateQueueUI();
    playTrack(state.queue[prevIdx]);
  }

  audio.addEventListener('progress', () => {
    if (audio.buffered.length > 0 && audio.duration > 0) {
      const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      const pct = (bufferedEnd / audio.duration) * 100;
      progressBuffer.style.width = `${pct}%`;
    }
  });

  audio.addEventListener('ended', playNext);

  audio.addEventListener('waiting', () => {
    playSpinner.classList.remove('hidden');
    iconPlay.classList.add('hidden');
    iconPause.classList.add('hidden');
  });

  audio.addEventListener('playing', () => {
    playSpinner.classList.add('hidden');
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');
  });

  // Seeking
  function seekToEvent(e) {
    const rect = progressContainer.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audio.duration) {
      audio.currentTime = pos * audio.duration;
      progressFill.style.width = `${pos * 100}%`;
    }
  }

  let isSeeking = false;
  progressContainer.addEventListener('mousedown', (e) => {
    isSeeking = true;
    seekToEvent(e);
  });
  window.addEventListener('mousemove', (e) => {
    if (isSeeking) seekToEvent(e);
  });
  window.addEventListener('mouseup', () => {
    if (isSeeking) isSeeking = false;
  });

  progressContainer.addEventListener('mousemove', (e) => {
    const rect = progressContainer.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audio.duration) {
      const hoverSec = pos * audio.duration;
      progressHoverTime.textContent = formatTime(hoverSec);
      progressHoverTime.style.left = `${pos * 100}%`;
      progressHoverTime.style.opacity = '1';
    }
  });
  progressContainer.addEventListener('mouseleave', () => {
    progressHoverTime.style.opacity = '0';
  });

  // =========================================================================
  // TRANSPORT & USER CONTROLS
  // =========================================================================

  btnPlay.addEventListener('click', () => {
    if (!state.currentTrack) {
      const firstRow = playlistTracksContainer.querySelector('.track-row');
      if (firstRow) firstRow.click();
      return;
    }
    if (state.isPlaying) pauseAudio();
    else playAudio();
  });

  btnPrev.addEventListener('click', playPrev);
  btnNext.addEventListener('click', playNext);

  btnRepeat.addEventListener('click', () => {
    if (state.repeatMode === 'off') {
      state.repeatMode = 'all';
      btnRepeat.classList.add('active');
      repeatIndicator.classList.add('hidden');
    } else if (state.repeatMode === 'all') {
      state.repeatMode = 'one';
      btnRepeat.classList.add('active');
      repeatIndicator.classList.remove('hidden');
    } else {
      state.repeatMode = 'off';
      btnRepeat.classList.remove('active');
      repeatIndicator.classList.add('hidden');
    }
  });

  const speeds = [1.0, 1.25, 1.5, 2.0, 0.75];
  btnSpeed.addEventListener('click', () => {
    const curIdx = speeds.indexOf(state.playbackSpeed);
    const nextIdx = (curIdx + 1) % speeds.length;
    state.playbackSpeed = speeds[nextIdx];
    audio.playbackRate = state.playbackSpeed;
    btnSpeed.textContent = `${state.playbackSpeed}x`;
  });

  volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.volume = val;
    state.isMuted = (val === 0);
    audio.volume = val;
    updateVolumeIcon();
  });

  btnMute.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    audio.volume = state.isMuted ? 0 : state.volume;
    updateVolumeIcon();
  });

  function updateVolumeIcon() {
    if (state.isMuted || state.volume === 0) {
      iconVolHigh.classList.add('hidden');
      iconVolMuted.classList.remove('hidden');
      volumeSlider.value = 0;
    } else {
      iconVolHigh.classList.remove('hidden');
      iconVolMuted.classList.add('hidden');
      volumeSlider.value = state.volume;
    }
  }

  // Floating "+ Playlist" Button on vinyl disc
  btnAddToPlaylistDisk.addEventListener('click', () => {
    openAddToPlaylistModal(state.currentTrack);
  });

  function openAddToPlaylistModal(track) {
    state.trackPendingAddToPlaylist = track || state.currentTrack;
    if (!state.trackPendingAddToPlaylist) {
      showToast("Play or select a track first!");
      return;
    }

    playlistTargetList.innerHTML = '';
    const names = Object.keys(state.customPlaylists);
    if (names.length === 0) {
      playlistTargetList.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:8px;">No custom playlists yet. Create one below!</div>`;
    } else {
      names.forEach(name => {
        const item = document.createElement('div');
        item.className = 'playlist-target-item';
        item.innerHTML = `
          <span>📁 ${name}</span>
          <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">${state.customPlaylists[name].length} tracks</span>
        `;
        item.addEventListener('click', () => {
          addTrackToPlaylist(name, state.trackPendingAddToPlaylist);
          addToPlaylistModal.classList.add('hidden');
        });
        playlistTargetList.appendChild(item);
      });
    }

    addToPlaylistModal.classList.remove('hidden');
  }

  btnCloseAddToPlaylist.addEventListener('click', () => addToPlaylistModal.classList.add('hidden'));

  btnQuickCreateAndAdd.addEventListener('click', () => {
    const name = quickNewPlaylistInput.value.trim();
    if (name) {
      createNewCustomPlaylist(name);
      addTrackToPlaylist(name, state.trackPendingAddToPlaylist);
      addToPlaylistModal.classList.add('hidden');
      quickNewPlaylistInput.value = '';
    }
  });

  // Modal: Create Custom Playlist
  btnOpenCreatePlaylistModal.addEventListener('click', () => {
    newPlaylistNameInput.value = '';
    createPlaylistModal.classList.remove('hidden');
    newPlaylistNameInput.focus();
  });
  btnCloseCreatePlaylist.addEventListener('click', () => createPlaylistModal.classList.add('hidden'));
  btnCancelCreatePlaylist.addEventListener('click', () => createPlaylistModal.classList.add('hidden'));
  btnConfirmCreatePlaylist.addEventListener('click', () => createNewCustomPlaylist(newPlaylistNameInput.value));
  newPlaylistNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createNewCustomPlaylist(newPlaylistNameInput.value);
  });

  btnDeleteCustomPlaylist.addEventListener('click', promptDeleteCurrentPlaylist);
  btnCloseDeleteModal?.addEventListener('click', () => confirmDeleteModal?.classList.add('hidden'));
  btnCancelDeleteModal?.addEventListener('click', () => confirmDeleteModal?.classList.add('hidden'));
  btnConfirmDeleteModal?.addEventListener('click', executeDeletePlaylist);

  // Outside click dismissals for modals
  confirmDeleteModal?.addEventListener('click', (e) => {
    if (e.target === confirmDeleteModal) confirmDeleteModal.classList.add('hidden');
  });
  saveQueueModal?.addEventListener('click', (e) => {
    if (e.target === saveQueueModal) saveQueueModal.classList.add('hidden');
  });
  createPlaylistModal?.addEventListener('click', (e) => {
    if (e.target === createPlaylistModal) createPlaylistModal.classList.add('hidden');
  });
  addToPlaylistModal?.addEventListener('click', (e) => {
    if (e.target === addToPlaylistModal) addToPlaylistModal.classList.add('hidden');
  });

  // Equalizer
  btnEqToggle.addEventListener('click', () => eqModal.classList.remove('hidden'));
  btnCloseEq.addEventListener('click', () => eqModal.classList.add('hidden'));
  eqModal.addEventListener('click', (e) => {
    if (e.target === eqModal) eqModal.classList.add('hidden');
  });

  function updateEq() {
    const b = parseFloat(eqBass.value);
    const m = parseFloat(eqMid.value);
    const t = parseFloat(eqTreble.value);
    eqBassVal.textContent = `${b > 0 ? '+' : ''}${b} dB`;
    eqMidVal.textContent = `${m > 0 ? '+' : ''}${m} dB`;
    eqTrebleVal.textContent = `${t > 0 ? '+' : ''}${t} dB`;
    visualizer.setEq(b, m, t);
  }

  eqBass.addEventListener('input', updateEq);
  eqMid.addEventListener('input', updateEq);
  eqTreble.addEventListener('input', updateEq);

  eqPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      eqPresetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const p = btn.dataset.preset;
      if (p === 'flat') { eqBass.value = 0; eqMid.value = 0; eqTreble.value = 0; }
      else if (p === 'bass') { eqBass.value = 9; eqMid.value = 0; eqTreble.value = -2; }
      else if (p === 'vocal') { eqBass.value = -3; eqMid.value = 6; eqTreble.value = 3; }
      else if (p === 'electronic') { eqBass.value = 8; eqMid.value = 2; eqTreble.value = 7; }
      updateEq();
    });
  });

  // Fullscreen
  document.getElementById('btnFullscreen')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(e => console.warn(e));
    } else {
      document.exitFullscreen().catch(e => console.warn(e));
    }
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (document.activeElement === searchInput || document.activeElement === newPlaylistNameInput || document.activeElement === quickNewPlaylistInput) {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      btnPlay.click();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      state.volume = Math.min(1, state.volume + 0.1);
      audio.volume = state.volume;
      updateVolumeIcon();
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      state.volume = Math.max(0, state.volume - 0.1);
      audio.volume = state.volume;
      updateVolumeIcon();
    } else if (e.key === 'm' || e.key === 'M') {
      btnMute.click();
    } else if (e.key === 'l' || e.key === 'L') {
      showMiddleView('lyrics');
    } else if (e.key === 'q' || e.key === 'Q') {
      showMiddleView('queue');
    } else if (e.key === 'f' || e.key === 'F') {
      document.getElementById('btnFullscreen')?.click();
    } else if (e.key === '/' || (e.ctrlKey && e.key === 'k')) {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // =========================================================================
  // BOOTSTRAP INITIALIZATION
  // =========================================================================

  loadPlaylistsFromStorage();
  renderPlaylistSelectDropdown();

  // Try restoring previous playback state
  const restored = restorePlaybackState();
  if (!restored) {
    // If no previous state, load active custom playlist
    loadPlaylist(state.activePlaylistKey);
  } else {
    // Load playlist tracks for active playlist
    loadPlaylist(state.activePlaylistKey);
  }
});
