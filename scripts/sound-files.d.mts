export function readSoundFiles(directory: string): Array<{
  file: string;
  body: Uint8Array;
  hash: string;
}>;
