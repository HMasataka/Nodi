import { useEffect, useRef, useState } from "react";

export interface Playback {
  playhead: number;
  playing: boolean;
  play(): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;
}

/** 再生・停止・シークの再生ヘッドを requestAnimationFrame で進める。 */
export function usePlayback(): Playback {
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frame = useRef<number | null>(null);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    function tick(now: number) {
      const last = previous.current;
      if (last !== null) setPlayhead((time) => time + (now - last));
      previous.current = now;
      frame.current = requestAnimationFrame(tick);
    }
    previous.current = null;
    frame.current = requestAnimationFrame(tick);
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current); };
  }, [playing]);

  return {
    playhead, playing,
    play: () => setPlaying(true),
    pause: () => setPlaying(false),
    stop: () => { setPlaying(false); setPlayhead(0); },
    seek: (time) => setPlayhead(time),
  };
}
