// Keep the element (and its user-gesture permission), but release its old source.
export function unloadAudio(audio: HTMLAudioElement) {
  const hadSource = Boolean(audio.getAttribute("src"));
  audio.onplaying = null;
  audio.onended = null;
  audio.onerror = null;
  audio.onloadedmetadata = null;
  audio.muted = true;
  audio.pause();
  audio.removeAttribute("src");
  // Avoid repeated pipeline resets when beginning from an already idle element.
  if (hadSource) audio.load();
  // Some media backends can report a delayed transition while idle.
  audio.onplaying = () => {
    if (!audio.getAttribute("src")) {
      audio.muted = true;
      audio.pause();
    }
  };
}

export function createPlaybackLifetime() {
  let generation = 0;
  return {
    invalidate() {
      generation += 1;
    },
    capture() {
      const captured = generation;
      return () => captured === generation;
    },
  };
}
