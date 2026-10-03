// Remote objects use immutable content-hash paths written by sync-sounds.mjs.
const soundBaseUrl = (import.meta.env.VITE_SOUND_BASE_URL?.trim() || "/sound").replace(/\/+$/, "");

export function getSoundUrl(file: string) {
  if (/^https?:\/\//i.test(soundBaseUrl) && __SOUND_HASHES__[file]) {
    return `${soundBaseUrl}/${__SOUND_HASHES__[file]}/${encodeURIComponent(file)}`;
  }
  return `${soundBaseUrl}/${encodeURIComponent(file)}`;
}
