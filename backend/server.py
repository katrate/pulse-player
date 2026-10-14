import os
import re
import time
import urllib.parse
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Query, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
import yt_dlp
from ytmusicapi import YTMusic
import requests

app = FastAPI(title="Crazy Music Player API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize YTMusic client
ytm = YTMusic()

# In-memory caches to speed up requests
stream_cache: Dict[str, Dict[str, Any]] = {}
lyrics_cache: Dict[str, Dict[str, Any]] = {}
search_cache: Dict[str, List[Dict[str, Any]]] = {}

# yt-dlp configuration
YDL_OPTS = {
    'format': 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
    'quiet': True,
    'no_warnings': True,
    'skip_download': True,
    'extract_flat': False,
    'js_runtimes': {'node': {}}
}

def clean_thumbnail(url: str, size: int = 544) -> str:
    """Upgrade YouTube thumbnail resolution."""
    if not url:
        return ""
    # Replace low-res sizes like =w120-h120 with high-res =w544-h544
    url = re.sub(r'=w\d+-h\d+[^?]*', f'=w{size}-h{size}-l90-rj', url)
    url = re.sub(r'=s\d+[^?]*', f'=s{size}', url)
    return url

def clean_string(s: str) -> str:
    """Removes video tags like (Official Music Video), [Lyric Video] for better lyrics matching."""
    if not s:
        return ""
    s = re.sub(r'\(.*?(official|video|audio|lyrics|hd|4k|feat|remix).*?\)', '', s, flags=re.IGNORECASE)
    s = re.sub(r'\[.*?(official|video|audio|lyrics|hd|4k|feat|remix).*?\]', '', s, flags=re.IGNORECASE)
    return s.strip()

def parse_lrc(lrc_text: str) -> List[Dict[str, Any]]:
    """Parse standard LRC format into [{ time: seconds, text: str }]"""
    lines = []
    pattern = re.compile(r'\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\](.*)')
    for raw_line in lrc_text.splitlines():
        match = pattern.match(raw_line.strip())
        if match:
            minutes = int(match.group(1))
            seconds = float(match.group(2))
            timestamp = round(minutes * 60 + seconds, 2)
            text = match.group(3).strip()
            if text:  # only non-empty lines or keep empty for pause
                lines.append({"time": timestamp, "text": text})
            else:
                lines.append({"time": timestamp, "text": "♪"})
    return lines

@app.get("/api/search")
def search(q: str = Query(..., min_length=1), filter_type: Optional[str] = Query("songs", alias="filter")):
    """Search for songs, videos, albums, or artists on YouTube Music."""
    active_filter = filter_type.lower().strip() if filter_type else ""
    if active_filter not in ["songs", "videos", "albums", "artists"]:
        active_filter = None

    cache_key = f"{q}:{active_filter}"
    if cache_key in search_cache:
        return {"results": search_cache[cache_key]}

    try:
        results = ytm.search(q, filter=active_filter)
        formatted = []
        for item in results:
            res_type = item.get("resultType", "song")
            
            # Parse artists
            artists = []
            if "artists" in item and isinstance(item["artists"], list):
                artists = [a.get("name", "") for a in item["artists"] if isinstance(a, dict)]
            artist_str = ", ".join([a for a in artists if a]) or item.get("artist", "") or "Unknown Artist"

            # Thumbnails
            thumbnails = item.get("thumbnails", [])
            thumb_url = thumbnails[-1]["url"] if thumbnails else ""
            thumb_url = clean_thumbnail(thumb_url, size=544)

            if res_type in ["song", "video"] or item.get("videoId"):
                video_id = item.get("videoId")
                if not video_id:
                    continue
                album_name = ""
                if "album" in item and isinstance(item["album"], dict):
                    album_name = item["album"].get("name", "")
                duration = item.get("duration", "0:00")

                formatted.append({
                    "id": video_id,
                    "title": item.get("title", "Untitled Track"),
                    "artist": artist_str,
                    "album": album_name,
                    "duration": duration,
                    "thumbnail": thumb_url,
                    "type": res_type
                })
            elif res_type == "album":
                browse_id = item.get("browseId", "")
                if not browse_id:
                    continue
                formatted.append({
                    "id": browse_id,
                    "browseId": browse_id,
                    "playlistId": item.get("playlistId", ""),
                    "title": item.get("title", "Untitled Album"),
                    "artist": artist_str,
                    "album": item.get("year", "Album"),
                    "duration": item.get("type", "Album"),
                    "thumbnail": thumb_url,
                    "type": "album"
                })
            elif res_type == "artist":
                browse_id = item.get("browseId", "")
                if not browse_id:
                    continue
                formatted.append({
                    "id": browse_id,
                    "browseId": browse_id,
                    "title": item.get("artist", "Artist"),
                    "artist": "Artist",
                    "album": "Verified Artist",
                    "duration": "",
                    "thumbnail": thumb_url,
                    "type": "artist"
                })

        search_cache[cache_key] = formatted
        return {"results": formatted}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/album/{browse_id}")
def get_album(browse_id: str):
    """Get all tracks from an album by browseId."""
    cache_key = f"album:{browse_id}"
    if cache_key in search_cache:
        return search_cache[cache_key]

    try:
        album = ytm.get_album(browse_id)
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")

        # Parse album artist
        artists = []
        if "artists" in album and isinstance(album["artists"], list):
            artists = [a.get("name", "") for a in album["artists"] if isinstance(a, dict)]
        album_artist = ", ".join([a for a in artists if a]) or "Unknown Artist"

        # Thumbnails
        thumbnails = album.get("thumbnails", [])
        album_thumb = thumbnails[-1]["url"] if thumbnails else ""
        album_thumb = clean_thumbnail(album_thumb, size=544)

        tracks = []
        for t in album.get("tracks", []):
            vid = t.get("videoId")
            if not vid:
                continue
            
            t_artists = []
            if "artists" in t and isinstance(t["artists"], list):
                t_artists = [a.get("name", "") for a in t["artists"] if isinstance(a, dict)]
            track_artist = ", ".join([a for a in t_artists if a]) or album_artist

            t_thumb = album_thumb
            if t.get("thumbnails"):
                t_thumb = clean_thumbnail(t["thumbnails"][-1]["url"], size=544)

            tracks.append({
                "id": vid,
                "title": t.get("title", "Untitled Track"),
                "artist": track_artist,
                "album": album.get("title", "Album"),
                "duration": t.get("duration", "0:00"),
                "thumbnail": t_thumb,
                "type": "song"
            })

        data = {
            "title": album.get("title", "Untitled Album"),
            "artist": album_artist,
            "year": album.get("year", ""),
            "thumbnail": album_thumb,
            "tracks": tracks
        }
        search_cache[cache_key] = data
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/artist/{browse_id}")
def get_artist(browse_id: str):
    """Get top songs from an artist by browseId."""
    cache_key = f"artist:{browse_id}"
    if cache_key in search_cache:
        return search_cache[cache_key]

    try:
        artist = ytm.get_artist(browse_id)
        if not artist:
            raise HTTPException(status_code=404, detail="Artist not found")

        artist_name = artist.get("name", "Unknown Artist")
        thumbnails = artist.get("thumbnails", [])
        artist_thumb = thumbnails[-1]["url"] if thumbnails else ""
        artist_thumb = clean_thumbnail(artist_thumb, size=544)

        tracks = []
        songs_data = artist.get("songs", {}).get("results", [])
        for t in songs_data:
            vid = t.get("videoId")
            if not vid:
                continue
            
            t_artists = []
            if "artists" in t and isinstance(t["artists"], list):
                t_artists = [a.get("name", "") for a in t["artists"] if isinstance(a, dict)]
            track_artist = ", ".join([a for a in t_artists if a]) or artist_name

            t_thumb = artist_thumb
            if t.get("thumbnails"):
                t_thumb = clean_thumbnail(t["thumbnails"][-1]["url"], size=544)

            album_name = ""
            if "album" in t and isinstance(t["album"], dict):
                album_name = t["album"].get("name", "")

            tracks.append({
                "id": vid,
                "title": t.get("title", "Untitled Track"),
                "artist": track_artist,
                "album": album_name,
                "duration": t.get("duration", "0:00"),
                "thumbnail": t_thumb,
                "type": "song"
            })

        data = {
            "artist": artist_name,
            "thumbnail": artist_thumb,
            "tracks": tracks
        }
        search_cache[cache_key] = data
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/charts")
def get_charts(category: str = Query("trending")):
    """Get trending songs, top global hits, or curated genre tracks."""
    queries = {
        "trending": "trending top hits songs 2026",
        "global": "global top 50 popular hits",
        "hiphop": "hip hop rap top tracks",
        "synthwave": "synthwave cyberpunk retrowave hits",
        "lofi": "lofi chill beats study sleep",
        "pop": "pop songs global top chart hits",
        "rock": "rock modern alternative hits",
        "edm": "electronic dance festival bangers"
    }
    search_q = queries.get(category, queries["trending"])
    return search(q=search_q, filter_type="songs")

@app.get("/api/stream/{video_id}")
def get_stream_url(video_id: str):
    """Extract direct audio stream URL and info using yt-dlp."""
    now = time.time()
    if video_id in stream_cache:
        cached = stream_cache[video_id]
        if now - cached["cached_at"] < 10800:  # 3 hours
            return cached["data"]

    yt_url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
            info = ydl.extract_info(yt_url, download=False)
            stream_url = info.get("url")
            if not stream_url:
                raise HTTPException(status_code=404, detail="Audio stream URL not found")

            # Extract best audio format metadata
            mime = info.get("ext", "webm")
            payload = {
                "id": video_id,
                "title": info.get("title"),
                "artist": info.get("uploader") or info.get("channel"),
                "duration": info.get("duration", 0),
                "thumbnail": clean_thumbnail(info.get("thumbnail", ""), size=600),
                "streamUrl": stream_url,
                "proxyUrl": f"/api/proxy/{video_id}",
                "mimeType": f"audio/{mime}"
            }

            stream_cache[video_id] = {
                "cached_at": now,
                "data": payload
            }
            return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract audio stream: {str(e)}")

@app.api_route("/api/proxy/{video_id}", methods=["GET", "HEAD"])
def stream_proxy(video_id: str, request: Request):
    """
    HTTP 206 Streaming Proxy.
    Solves all CORS, origin, and seeking Range issues seamlessly for Web Audio API!
    """
    stream_info = get_stream_url(video_id)
    stream_url = stream_info.get("streamUrl")
    if not stream_url:
        raise HTTPException(status_code=404, detail="Audio stream unavailable")

    range_header = request.headers.get("Range")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*"
    }
    if range_header:
        headers["Range"] = range_header

    try:
        # Request stream from YouTube/GoogleVideo
        upstream = requests.get(stream_url, headers=headers, stream=True, timeout=15)
        
        response_headers = {
            "Accept-Ranges": "bytes",
            "Content-Type": upstream.headers.get("Content-Type", stream_info.get("mimeType", "audio/webm")),
            "Cache-Control": "public, max-age=7200",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Range, Accept, Content-Type",
            "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges"
        }

        if "Content-Range" in upstream.headers:
            response_headers["Content-Range"] = upstream.headers["Content-Range"]
        if "Content-Length" in upstream.headers:
            response_headers["Content-Length"] = upstream.headers["Content-Length"]

        if request.method == "HEAD":
            return Response(status_code=upstream.status_code, headers=response_headers, media_type=response_headers["Content-Type"])

        def iter_chunks():
            try:
                for chunk in upstream.iter_content(chunk_size=65536):
                    if chunk:
                        yield chunk
            except Exception:
                pass

        return StreamingResponse(
            iter_chunks(),
            status_code=upstream.status_code,
            headers=response_headers,
            media_type=response_headers["Content-Type"]
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Proxy error: {str(e)}")

@app.get("/api/lyrics")
def get_lyrics(title: str = Query(...), artist: str = Query(""), duration: Optional[int] = None):
    """
    Fetches real-time synchronized LRC lyrics from LRCLIB.
    Falls back to text search if direct match misses.
    """
    cache_key = f"{title.lower()}:{artist.lower()}"
    if cache_key in lyrics_cache:
        return lyrics_cache[cache_key]

    clean_t = clean_string(title)
    # Extract primary artist (before comma or feat)
    clean_a = re.split(r'[,&]|\bfeat\b|\bft\b', artist, flags=re.IGNORECASE)[0].strip()

    result = {
        "synced": False,
        "lines": [],
        "plainLyrics": "",
        "source": None
    }

    headers = {"User-Agent": "CrazyMusicPlayer/1.0 (https://github.com/player)"}

    # 1. Try exact match on LRCLIB
    try:
        params = {"track_name": clean_t, "artist_name": clean_a}
        if duration and duration > 0:
            params["duration"] = duration
        resp = requests.get("https://lrclib.net/api/get", params=params, headers=headers, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("syncedLyrics"):
                result["synced"] = True
                result["lines"] = parse_lrc(data["syncedLyrics"])
                result["plainLyrics"] = data.get("plainLyrics", "")
                result["source"] = "LRCLIB"
                lyrics_cache[cache_key] = result
                return result
            elif data.get("plainLyrics"):
                result["synced"] = False
                result["plainLyrics"] = data["plainLyrics"]
                result["source"] = "LRCLIB (Plain)"
    except Exception:
        pass

    # 2. Try search match on LRCLIB
    try:
        search_query = f"{clean_t} {clean_a}".strip()
        resp = requests.get("https://lrclib.net/api/search", params={"q": search_query}, headers=headers, timeout=4)
        if resp.status_code == 200:
            items = resp.json()
            if isinstance(items, list) and items:
                # Prioritize item with syncedLyrics
                best = next((it for it in items if it.get("syncedLyrics")), items[0])
                if best.get("syncedLyrics"):
                    result["synced"] = True
                    result["lines"] = parse_lrc(best["syncedLyrics"])
                    result["plainLyrics"] = best.get("plainLyrics", "")
                    result["source"] = "LRCLIB"
                    lyrics_cache[cache_key] = result
                    return result
                elif best.get("plainLyrics"):
                    result["synced"] = False
                    result["plainLyrics"] = best["plainLyrics"]
                    result["source"] = "LRCLIB (Plain)"
    except Exception:
        pass

    lyrics_cache[cache_key] = result
    return result

# Serve static frontend files
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Crazy Music Player API is active. Frontend is compiling..."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host="0.0.0.0", port=5000, reload=True)
