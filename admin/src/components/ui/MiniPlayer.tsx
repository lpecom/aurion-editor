import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface MiniPlayerProps {
  title: string;
  artist: string;
  src: string;
  autoPrompt?: boolean;
}

export default function MiniPlayer({ title, artist, src, autoPrompt = true }: MiniPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [prompted, setPrompted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      audio.pause();
      setPlaying(false);
    }
    setPrompted(true);
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => setPlaying(false);

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
  }, [duration]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (dismissed) return null;

  // Auto-prompt: show a banner asking to play
  if (autoPrompt && !prompted) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
        <div className="bg-surface border border-border/50 rounded-2xl shadow-2xl backdrop-blur-xl p-4 w-72">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Volume2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text truncate">{title}</p>
              <p className="text-xs text-text-muted truncate">{artist}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggle}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-xl bg-primary text-bg hover:bg-primary/90 cursor-pointer transition-colors"
            >
              <Play className="w-4 h-4" />
              Tocar
            </button>
            <button
              onClick={() => { setPrompted(true); setDismissed(true); }}
              className="px-3 py-2 text-sm text-text-muted hover:text-text rounded-xl hover:bg-surface-2 cursor-pointer transition-colors"
            >
              Nah
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="bg-surface border border-border/50 rounded-2xl shadow-2xl backdrop-blur-xl p-3 w-72">
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-xl bg-primary/10 hover:bg-primary/20 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
          >
            {playing ? (
              <Pause className="w-4 h-4 text-primary" />
            ) : (
              <Play className="w-4 h-4 text-primary ml-0.5" />
            )}
          </button>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-text truncate">{title}</p>
            <p className="text-[10px] text-text-muted truncate">{artist}</p>
          </div>

          {/* Mute */}
          <button
            onClick={toggleMute}
            className="p-1.5 text-text-muted hover:text-text rounded-lg cursor-pointer transition-colors"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Close */}
          <button
            onClick={() => { audioRef.current?.pause(); setDismissed(true); }}
            className="p-1 text-text-muted hover:text-text text-xs cursor-pointer"
          >
            &times;
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-text-muted font-mono w-7 text-right">{fmt(progress)}</span>
          <div
            className="flex-1 h-1 bg-surface-2 rounded-full cursor-pointer group"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-primary rounded-full relative transition-all"
              style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" />
            </div>
          </div>
          <span className="text-[10px] text-text-muted font-mono w-7">{fmt(duration)}</span>
        </div>
      </div>
    </div>
  );
}
