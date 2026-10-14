/**
 * PULSE AUDIO // Real-Time Synchronized LRCLIB Lyrics Engine
 */

class LyricsManager {
  constructor() {
    this.lines = [];
    this.activeIndex = -1;
    this.isSynced = false;
    this.userScrolling = false;
    this.scrollTimeout = null;

    this.container = document.getElementById('lyricsLines');
    this.viewport = document.getElementById('lyricsViewport');
    this.placeholder = document.getElementById('lyricsPlaceholder');
    this.statusBadge = document.getElementById('lyricsStatusBadge');
    this.titleEl = document.getElementById('lyricsTrackTitle');
    this.artistEl = document.getElementById('lyricsTrackArtist');

    this.onSeekCallback = null;
    this.initScrollDetector();
  }

  setSeekCallback(fn) {
    this.onSeekCallback = fn;
  }

  initScrollDetector() {
    if (!this.viewport) return;
    this.viewport.addEventListener('wheel', () => {
      this.userScrolling = true;
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.userScrolling = false;
      }, 3500);
    }, { passive: true });

    this.viewport.addEventListener('touchmove', () => {
      this.userScrolling = true;
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.userScrolling = false;
      }, 3500);
    }, { passive: true });
  }

  async load(title, artist, duration) {
    this.reset();
    if (this.titleEl) this.titleEl.textContent = title;
    if (this.artistEl) this.artistEl.textContent = artist;

    if (this.statusBadge) {
      this.statusBadge.textContent = 'Searching...';
      this.statusBadge.className = 'lyrics-status-badge';
    }

    try {
      const url = `/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&duration=${Math.round(duration || 0)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Lyrics request failed");
      const data = await res.json();

      if (data.synced && Array.isArray(data.lines) && data.lines.length > 0) {
        this.isSynced = true;
        this.lines = data.lines;
        if (this.statusBadge) {
          this.statusBadge.textContent = 'Synced LRCLIB';
          this.statusBadge.style.color = 'var(--accent-cyan)';
          this.statusBadge.style.borderColor = 'rgba(0, 245, 212, 0.4)';
        }
        this.renderSyncedLines();
      } else if (data.plainLyrics) {
        this.isSynced = false;
        if (this.statusBadge) {
          this.statusBadge.textContent = 'Plain Lyrics';
          this.statusBadge.style.color = 'var(--text-secondary)';
          this.statusBadge.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        }
        this.renderPlainLines(data.plainLyrics);
      } else {
        this.renderNotFound();
      }
    } catch (e) {
      console.warn("Failed to fetch lyrics:", e);
      this.renderNotFound();
    }
  }

  renderSyncedLines() {
    if (!this.container) return;
    if (this.placeholder) this.placeholder.classList.add('hidden');
    this.container.innerHTML = '';

    this.lines.forEach((line, idx) => {
      const el = document.createElement('div');
      el.className = 'lyric-line';
      el.dataset.index = idx;
      el.dataset.time = line.time;
      el.textContent = line.text;

      // Click to seek directly in song!
      el.addEventListener('click', () => {
        if (this.onSeekCallback) {
          this.onSeekCallback(line.time);
        }
      });

      this.container.appendChild(el);
    });
  }

  renderPlainLines(text) {
    if (!this.container) return;
    if (this.placeholder) this.placeholder.classList.add('hidden');
    this.container.innerHTML = '';

    const lines = text.split('\n');
    lines.forEach(lineText => {
      const el = document.createElement('div');
      el.className = 'lyric-line';
      el.style.cursor = 'default';
      el.textContent = lineText || ' ';
      this.container.appendChild(el);
    });
  }

  renderNotFound() {
    if (this.placeholder) {
      this.placeholder.classList.remove('hidden');
      this.placeholder.innerHTML = `
        <div class="lyrics-empty-icon">🎙️</div>
        <p>No synced lyrics found for this track on LRCLIB.</p>
        <span style="font-size:12px;color:var(--text-muted);margin-top:8px;">Enjoy the instrumental or audio visualizer!</span>
      `;
    }
    if (this.statusBadge) {
      this.statusBadge.textContent = 'No Lyrics';
      this.statusBadge.style.color = 'var(--text-muted)';
      this.statusBadge.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    }
    if (this.container) this.container.innerHTML = '';
  }

  updateTime(currentTime) {
    if (!this.isSynced || this.lines.length === 0) return;

    // Find the latest line with timestamp <= currentTime
    let activeIdx = -1;
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].time <= currentTime + 0.15) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== this.activeIndex) {
      // Remove previous active
      if (this.activeIndex >= 0) {
        const prevEl = this.container.querySelector(`.lyric-line[data-index="${this.activeIndex}"]`);
        if (prevEl) prevEl.classList.remove('active');
      }

      this.activeIndex = activeIdx;

      // Set new active
      if (this.activeIndex >= 0) {
        const currEl = this.container.querySelector(`.lyric-line[data-index="${this.activeIndex}"]`);
        if (currEl) {
          currEl.classList.add('active');
          if (!this.userScrolling) {
            currEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }
  }

  reset() {
    this.lines = [];
    this.activeIndex = -1;
    this.isSynced = false;
    this.userScrolling = false;
    if (this.container) this.container.innerHTML = '';
    if (this.placeholder) this.placeholder.classList.remove('hidden');
  }
}

window.LyricsManager = LyricsManager;
