# PULSE // Vinyl Audiophile Player

A Spotify-grade, open-source web music streaming player built with an authentic spinning vinyl record aesthetic, real-time synchronized lyrics, smart queue management, search filters, and custom playlist support.

![PULSE Audiophile Player](public/index.html)

## ✨ Features

- **💿 Vinyl Turntable Aesthetic**: Animated realistic vinyl disc with dynamic grooves, reflective sheen, and smooth tonearm tracking during playback.
- **✨ Dynamic Ambient Glow**: Aura background extracted from the active track's cover art using HTML5 Canvas color sampling.
- **📜 Synced Lyrics (LRCLIB)**: Interactive real-time lyric scrolling with seek-on-click synchronization.
- **📋 Spotify-Grade Queue System**:
  - Live **Now Playing** card with upcoming tracks list.
  - Drag-and-drop track reordering.
  - Context menu: Play Now, Play Next, Move to Top, Add to Playlist, Remove from Queue.
  - **Save Queue as Playlist** modal to preserve your favorite queue mixes.
  - Upcoming track counter badge.
- **🔍 YouTube Music Search with Filters**:
  - Filter chips for **Songs**, **Videos**, **Albums**, and **Artists**.
  - Interactive album cards to explore and load complete album tracklists.
  - Artist cards to discover verified artist top tracks.
- **📁 Custom Playlists**:
  - Create, switch, play, and shuffle custom playlists stored in `localStorage`.
  - Delete playlist modal with confirmation safeguards.
  - In-app track addition modal with quick new playlist creation.
- **🎛️ 3-Band Equalizer & Presets**:
  - Bass Boost, Vocal Clear, Cyber Rave, and Flat presets with real-time Web Audio API biquad filters.
- **💾 State Persistence**:
  - Remembers your currently playing song, playback timestamp, volume, queue, and playlists across browser reloads.

## 🚀 Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern Glassmorphism & Cyberpunk Vinyl theme), Vanilla JavaScript (Web Audio API, Canvas).
- **Backend**: FastAPI (Python), `ytmusicapi` for YouTube Music search and metadata, `yt-dlp` for audio stream extraction, `LRCLIB` for real-time synchronized lyrics.

## 🛠️ Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/katrate/pulse-player.git
   cd pulse-player
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the local server:**
   ```bash
   python backend/server.py
   ```

4. **Open in browser:**
   Navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000)

## 🌐 Deployment

Configured for **Vercel** serverless Python runtime with `vercel.json` and static frontend hosting.
