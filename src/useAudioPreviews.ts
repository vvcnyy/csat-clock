import { useCallback, useEffect, useRef, useState } from "react";
import { bellEvents } from "./schedule";

interface AudioPreviewOptions {
  bellVolume: number;
  englishFile?: File;
  listeningVolume: number;
  onError: (message: string) => void;
}

export function useAudioPreviews({
  bellVolume,
  englishFile,
  listeningVolume,
  onError,
}: AudioPreviewOptions) {
  const bellAudio = useRef<HTMLAudioElement | undefined>(undefined);
  const listeningAudio = useRef<HTMLAudioElement | undefined>(undefined);
  const listeningUrl = useRef<string | undefined>(undefined);
  const [previewing, setPreviewing] = useState(false);
  const [listeningPreviewing, setListeningPreviewing] = useState(false);

  useEffect(() => {
    if (bellAudio.current) bellAudio.current.volume = bellVolume;
  }, [bellVolume]);

  useEffect(() => {
    if (listeningAudio.current) listeningAudio.current.volume = listeningVolume;
  }, [listeningVolume]);

  const stopBellPreview = useCallback(() => {
    if (!bellAudio.current) return;
    bellAudio.current.pause();
    bellAudio.current.currentTime = 0;
    bellAudio.current = undefined;
    setPreviewing(false);
  }, []);

  const stopListeningPreview = useCallback(() => {
    if (!listeningAudio.current) return;
    listeningAudio.current.pause();
    listeningAudio.current.currentTime = 0;
    listeningAudio.current = undefined;
    if (listeningUrl.current) URL.revokeObjectURL(listeningUrl.current);
    listeningUrl.current = undefined;
    setListeningPreviewing(false);
  }, []);

  useEffect(
    () => () => {
      stopBellPreview();
      stopListeningPreview();
    },
    [stopBellPreview, stopListeningPreview],
  );

  const testBell = useCallback(() => {
    if (bellAudio.current) {
      stopBellPreview();
      return;
    }
    const sample = bellEvents.find((event) => event.kind === "preliminary")!;
    const audio = new Audio(`/${encodeURIComponent(sample.file)}`);
    audio.volume = bellVolume;
    bellAudio.current = audio;
    setPreviewing(true);
    audio.play().catch(() => {
      bellAudio.current = undefined;
      setPreviewing(false);
      onError("소리 확인을 재생할 수 없습니다.");
    });
    audio.onended = () => {
      bellAudio.current = undefined;
      setPreviewing(false);
    };
  }, [bellVolume, onError, stopBellPreview]);

  const testListening = useCallback(() => {
    if (listeningAudio.current) {
      stopListeningPreview();
      return;
    }
    if (!englishFile) {
      onError("먼저 영어 듣기 파일을 선택해 주세요.");
      return;
    }
    const url = URL.createObjectURL(englishFile);
    const audio = new Audio(url);
    audio.volume = listeningVolume;
    listeningAudio.current = audio;
    listeningUrl.current = url;
    setListeningPreviewing(true);
    audio.play().catch(() => {
      URL.revokeObjectURL(url);
      listeningAudio.current = undefined;
      listeningUrl.current = undefined;
      setListeningPreviewing(false);
      onError("영어 듣기 파일을 재생할 수 없습니다.");
    });
    audio.onended = () => {
      URL.revokeObjectURL(url);
      listeningAudio.current = undefined;
      listeningUrl.current = undefined;
      setListeningPreviewing(false);
    };
  }, [englishFile, listeningVolume, onError, stopListeningPreview]);

  return {
    listeningPreviewing,
    previewing,
    stopBellPreview,
    stopListeningPreview,
    testBell,
    testListening,
  };
}
