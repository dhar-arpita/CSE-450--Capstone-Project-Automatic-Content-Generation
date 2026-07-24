# import os
# import re
# import requests
# from dotenv import load_dotenv
# load_dotenv()

# YOUTUBE_API_KEY    = os.getenv("YOUTUBE_API_KEY", "")
# YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
# YOUTUBE_VIDEO_URL  = "https://www.googleapis.com/youtube/v3/videos"

# BANGLA_EDU_CHANNELS = [
#     "UCnXmuphQV3fxs51znrr4eng",  # 10MS Class 6-10
#     "UC9FIxBsM5evfb8n0z0gVhnQ",  # 10 Minute School SSC
#     "UCYfTpKVP5YQ7t7p6_eJhSEQ",  # Shikho
# ]

# def parse_duration(duration: str) -> str:
#     if not duration:
#         return ""
#     match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration)
#     if not match:
#         return ""
#     hours   = int(match.group(1) or 0)
#     minutes = int(match.group(2) or 0)
#     seconds = int(match.group(3) or 0)
#     if hours:
#         return f"{hours}:{minutes:02d}:{seconds:02d}"
#     return f"{minutes}:{seconds:02d}"

# def run_video_search_agent(
#     topic_name:  str,
#     class_name:  str,
#     subject_name:str,
#     language:    str = "english",
#     max_results: int = 4
# ) -> list:

#     if not YOUTUBE_API_KEY:
#         print("[Video Search] No API key found — skipping")
#         return []

#     print(f"[Video Search] Language: {language}")

#     try:
#         # ── BANGLA: বাংলা educational channels এ search ──
#         if language == "bangla":
#             query = f"{topic_name} {subject_name} class {class_name}"
#             print(f"[Video Search] Bangla query: '{query}'")

#             all_video_ids = []
#             for channel_id in BANGLA_EDU_CHANNELS:
#                 ch_resp = requests.get(
#                     YOUTUBE_SEARCH_URL,
#                     params={
#                         "part":       "snippet",
#                         "q":          query,
#                         "channelId":  channel_id,
#                         "type":       "video",
#                         "maxResults": 2,
#                         "safeSearch": "strict",
#                         "key":        YOUTUBE_API_KEY
#                     },
#                     timeout=10
#                 )
#                 ch_data = ch_resp.json()
#                 if "error" not in ch_data:
#                     for item in ch_data.get("items", []):
#                         vid = item.get("id", {}).get("videoId")
#                         if vid and vid not in all_video_ids:
#                             all_video_ids.append(vid)

#             video_ids = all_video_ids[:max_results]

#         # ── ENGLISH: general YouTube search ──
#         else:
#             query = f'"{topic_name}" {subject_name} class {class_name} animation explained'
#             print(f"[Video Search] English query: '{query}'")

#             search_resp = requests.get(
#                 YOUTUBE_SEARCH_URL,
#                 params={
#                     "part":              "snippet",
#                     "q":                 query,
#                     "type":              "video",
#                     "maxResults":        max_results,
#                     "relevanceLanguage": "en",
#                     "safeSearch":        "strict",
#                     "key":               YOUTUBE_API_KEY
#                 },
#                 timeout=10
#             )
#             search_data = search_resp.json()

#             if "error" in search_data:
#                 print(f"[Video Search] API error: {search_data['error']['message']}")
#                 return []

#             video_ids = [
#                 item["id"]["videoId"]
#                 for item in search_data.get("items", [])
#                 if item.get("id", {}).get("videoId")
#             ]

#         if not video_ids:
#             print("[Video Search] No videos found")
#             return []

#         # ── Video details আনো ──
#         detail_resp = requests.get(
#             YOUTUBE_VIDEO_URL,
#             params={
#                 "part": "contentDetails,statistics,snippet",
#                 "id":   ",".join(video_ids),
#                 "key":  YOUTUBE_API_KEY
#             },
#             timeout=10
#         )
#         detail_data = detail_resp.json()

#         videos = []
#         for item in detail_data.get("items", []):
#             video_id = item["id"]
#             snippet  = item.get("snippet", {})
#             stats    = item.get("statistics", {})
#             duration = item.get("contentDetails", {}).get("duration", "")

#             view_count = int(stats.get("viewCount", 0))
#             if view_count >= 1_000_000:
#                 views = f"{view_count/1_000_000:.1f}M views"
#             elif view_count >= 1_000:
#                 views = f"{view_count/1_000:.0f}K views"
#             else:
#                 views = f"{view_count} views"

#             videos.append({
#                 "title":     snippet.get("title", ""),
#                 "channel":   snippet.get("channelTitle", ""),
#                 "url":       f"https://www.youtube.com/watch?v={video_id}",
#                 "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
#                 "duration":  parse_duration(duration),
#                 "views":     views,
#             })

#         print(f"[Video Search] Found {len(videos)} videos")
#         return videos

#     except requests.exceptions.Timeout:
#         print("[Video Search] Request timed out")
#         return []
#     except Exception as e:
#         print(f"[Video Search] Error: {e}")
#         return []







import os
import re
import requests
from dotenv import load_dotenv
load_dotenv()

YOUTUBE_API_KEY    = os.getenv("YOUTUBE_API_KEY", "")
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
YOUTUBE_VIDEO_URL  = "https://www.googleapis.com/youtube/v3/videos"

BANGLA_EDU_CHANNELS = [
    "UCnXmuphQV3fxs51znrr4eng",  # 10MS Class 6-10
    "UC9FIxBsM5evfb8n0z0gVhnQ",  # 10 Minute School SSC
    "UCYfTpKVP5YQ7t7p6_eJhSEQ",  # Shikho
]

def parse_duration(duration: str) -> str:
    if not duration:
        return ""
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration)
    if not match:
        return ""
    hours   = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    if hours:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    return f"{minutes}:{seconds:02d}"

# def fetch_video_details(video_ids: list) -> list:
#     if not video_ids:
#         return []
#     detail_resp = requests.get(
#         YOUTUBE_VIDEO_URL,
#         params={
#             "part": "contentDetails,statistics,snippet",
#             "id":   ",".join(video_ids),
#             "key":  YOUTUBE_API_KEY
#         },
#         timeout=10
#     )
#     videos = []
#     for item in detail_resp.json().get("items", []):
#         snippet    = item.get("snippet", {})
#         stats      = item.get("statistics", {})
#         duration   = item.get("contentDetails", {}).get("duration", "")
#         view_count = int(stats.get("viewCount", 0))
#         if view_count >= 1_000_000:
#             views = f"{view_count/1_000_000:.1f}M views"
#         elif view_count >= 1_000:
#             views = f"{view_count/1_000:.0f}K views"
#         else:
#             views = f"{view_count} views"
#         videos.append({
#             "title":     snippet.get("title", ""),
#             "channel":   snippet.get("channelTitle", ""),
#             "url":       f"https://www.youtube.com/watch?v={item['id']}",
#             "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
#             "duration":  parse_duration(duration),
#             "views":     views,
#         })
#     return videos


def fetch_video_details(video_ids: list) -> list:
    if not video_ids:
        return []
    detail_resp = requests.get(
        YOUTUBE_VIDEO_URL,
        params={
            "part": "contentDetails,statistics,snippet",
            "id":   ",".join(video_ids),
            "key":  YOUTUBE_API_KEY
        },
        timeout=10
    )
    videos = []
    for item in detail_resp.json().get("items", []):
        snippet    = item.get("snippet", {})
        stats      = item.get("statistics", {})
        duration   = item.get("contentDetails", {}).get("duration", "")

        # Shorts filter — 60 second এর কম বাদ দাও
        dur_str = parse_duration(duration)
        if dur_str:
            parts = dur_str.split(":")
            if len(parts) == 2:
                total_seconds = int(parts[0]) * 60 + int(parts[1])
                if total_seconds < 60:   # 1 মিনিটের কম = short বাদ
                    continue

        # Title এ irrelevant keywords থাকলে বাদ দাও
        title = snippet.get("title", "").lower()
        skip_keywords = ["#shorts", "funny", "comedy", "meme", "joke", "hindi"]
        if any(kw in title for kw in skip_keywords):
            continue

        view_count = int(stats.get("viewCount", 0))
        if view_count >= 1_000_000:
            views = f"{view_count/1_000_000:.1f}M views"
        elif view_count >= 1_000:
            views = f"{view_count/1_000:.0f}K views"
        else:
            views = f"{view_count} views"

        videos.append({
            "title":     snippet.get("title", ""),
            "channel":   snippet.get("channelTitle", ""),
            "url":       f"https://www.youtube.com/watch?v={item['id']}",
            "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
            "duration":  parse_duration(duration),
            "views":     views,
        })
    return videos

def search_bangla_channels(topic_name, class_name, subject_name) -> list:
    query = f"{topic_name} {subject_name} class {class_name}"
    print(f"[Video Search] Bangla channel search: '{query}'")
    all_video_ids = []
    for channel_id in BANGLA_EDU_CHANNELS:
        try:
            resp = requests.get(
                YOUTUBE_SEARCH_URL,
                params={
                    "part":       "snippet",
                    "q":          query,
                    "channelId":  channel_id,
                    "type":       "video",
                    "maxResults": 2,
                    "safeSearch": "strict",
                    "key":        YOUTUBE_API_KEY
                },
                timeout=10
            )
            data = resp.json()
            if "error" not in data:
                for item in data.get("items", []):
                    vid = item.get("id", {}).get("videoId")
                    if vid and vid not in all_video_ids:
                        all_video_ids.append(vid)
        except Exception as e:
            print(f"[Video Search] Channel error: {e}")
    return fetch_video_details(all_video_ids)

def search_general_youtube(topic_name, class_name, subject_name, language) -> list:
    if language == "bangla":
        query = f"{topic_name} {subject_name} class {class_name} animation বাংলা"
        lang  = "bn"
    else:
        query = f'"{topic_name}" {subject_name} class {class_name} animation explained'
        lang  = "en"
    print(f"[Video Search] General search: '{query}'")
    try:
        resp = requests.get(
            YOUTUBE_SEARCH_URL,
            params={
                "part":              "snippet",
                "q":                 query,
                "type":              "video",
                "maxResults":        4,
                "relevanceLanguage": lang,
                "safeSearch":        "strict",
                "key":               YOUTUBE_API_KEY
            },
            timeout=10
        )
        data = resp.json()
        if "error" in data:
            return []
        video_ids = [
            item["id"]["videoId"]
            for item in data.get("items", [])
            if item.get("id", {}).get("videoId")
        ]
        return fetch_video_details(video_ids)
    except Exception as e:
        print(f"[Video Search] General error: {e}")
        return []

def run_video_search_agent(
    topic_name:   str,
    class_name:   str,
    subject_name: str,
    language:     str = "english",
    max_results:  int = 4
) -> list:

    if not YOUTUBE_API_KEY:
        print("[Video Search] No API key — skipping")
        return []

    print(f"[Video Search] Language: {language}")

    try:
        if language == "bangla":
            # Step 1: 10MS + Shikho তে খোঁজো
            videos = search_bangla_channels(topic_name, class_name, subject_name)
            print(f"[Video Search] Bangla channels: {len(videos)} found")

            # Step 2: কম পেলে general search দিয়ে fill করো
            if len(videos) < 4:
                print("[Video Search] Falling back to general search")
                extra = search_general_youtube(
                    topic_name, class_name, subject_name, "bangla"
                )
                existing = {v["url"] for v in videos}
                for v in extra:
                    if v["url"] not in existing:
                        videos.append(v)
                        existing.add(v["url"])
        else:
            # English: animation focused search
            videos = search_general_youtube(
                topic_name, class_name, subject_name, "english"
            )

        result = videos[:max_results]
        print(f"[Video Search] Final: {len(result)} videos")
        return result

    except Exception as e:
        print(f"[Video Search] Error: {e}")
        return []
