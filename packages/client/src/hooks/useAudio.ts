import { useState, useEffect, useRef } from 'react';

interface UseAudioOptions {
  volume?: number;
  loop?: boolean;
  autoPlay?: boolean;
}

export const useAudio = (url: string, options: UseAudioOptions = {}) => {
  const {
    volume = 0.5,
    loop = false,
    autoPlay = false
  } = options;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVolume, setCurrentVolume] = useState(volume);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    // Create audio element
    const audio = new Audio(url);
    audio.volume = currentVolume;
    audio.loop = loop;

    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
    });

    audioRef.current = audio;

    if (autoPlay) {
      audio.play().catch(err => {
        console.warn('Audio autoplay blocked:', err);
      });
      setIsPlaying(true);
    }

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [url, loop, autoPlay]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = currentVolume;
    }
  }, [currentVolume]);

  const play = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(err => {
        console.warn('Audio play failed:', err);
      });
      setIsPlaying(true);
    }
  };

  const pause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const fadeOut = (duration: number = 1000) => {
    if (audioRef.current) {
      const audio = audioRef.current;
      const startVolume = audio.volume;
      const fadeStep = startVolume / (duration / 50);

      const fadeInterval = setInterval(() => {
        if (audio.volume > 0.01) {
          audio.volume = Math.max(0, audio.volume - fadeStep);
        } else {
          audio.volume = 0;
          clearInterval(fadeInterval);
          pause();
          audio.volume = startVolume; // Reset volume for next play
        }
      }, 50);
    }
  };

  const setVolume = (vol: number) => {
    setCurrentVolume(Math.max(0, Math.min(1, vol)));
  };

  return {
    isPlaying,
    volume: currentVolume,
    duration,
    currentTime,
    play,
    pause,
    stop,
    fadeOut,
    setVolume
  };
};

