// Loads the YouTube IFrame Player API once per page. Using the real JS API
// (instead of autoplay/loop URL params) lets us drive playback ourselves,
// which avoids the native play/pause icon YouTube briefly flashes over its
// own url-param-based loop restarts.

export interface YTPlayer {
  mute(): void;
  playVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  loadVideoById(videoId: string): void;
  destroy(): void;
}

export interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number; target: YTPlayer }) => void;
      };
    }
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number; BUFFERING: number; CUED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API requires a browser environment"));
  }
  if (window.YT) {
    return Promise.resolve(window.YT);
  }
  if (apiPromise) {
    return apiPromise;
  }
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT as YTNamespace);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

export interface BackgroundPlayerHandle {
  loadVideo(videoId: string): void;
  stop(): void;
  destroy(): void;
}

/** A muted, looping, chromeless YouTube player for use as decorative
 * background video (hero carousel, anime detail banner, ...). Drives
 * playback itself (mute/play/seek-on-end) instead of relying on
 * autoplay/loop URL params, which makes YouTube flash its native
 * play/pause control icon on every loop restart. */
export function createBackgroundPlayer(
  host: HTMLElement,
  initialVideoId: string,
  onPlaying: () => void
): BackgroundPlayerHandle {
  const ready = loadYouTubeIframeApi().then(
    (YT) =>
      new Promise<YTPlayer>((resolve) => {
        new YT.Player(host, {
          videoId: initialVideoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            origin: window.location.origin
          },
          events: {
            onReady: (e) => {
              e.target.mute();
              e.target.playVideo();
              resolve(e.target);
            },
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.PLAYING) {
                onPlaying();
              } else if (e.data === YT.PlayerState.ENDED) {
                e.target.seekTo(0);
                e.target.playVideo();
              }
            }
          }
        });
      })
  );

  return {
    loadVideo(videoId: string): void {
      void ready.then((player) => player.loadVideoById(videoId));
    },
    stop(): void {
      void ready.then((player) => player.stopVideo());
    },
    destroy(): void {
      void ready.then((player) => player.destroy());
    }
  };
}
