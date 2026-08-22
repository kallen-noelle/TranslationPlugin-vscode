/**
 * Plays MP3 audio bytes using the OS-native player (no visible UI).
 */

import { exec } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

let lastAudioFile: string | undefined;

function writeTempFile(data: Uint8Array): string {
  if (lastAudioFile) {
    try {
      fs.unlinkSync(lastAudioFile);
    } catch {
      // ignore
    }
  }
  const file = path.join(
    os.tmpdir(),
    `translation-${crypto.randomBytes(8).toString('hex')}.mp3`,
  );
  fs.writeFileSync(file, data);
  lastAudioFile = file;
  return file;
}

function run(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Plays the given MP3 bytes.
 *
 * @param data MP3 audio bytes.
 */
export async function playAudio(data: Uint8Array): Promise<void> {
  const file = writeTempFile(data);

  try {
    if (process.platform === 'win32') {
      // Powershell SoundPlayer supports WAV/MP3 playback asynchronously.
      const script =
        `$player = New-Object System.Media.SoundPlayer; ` +
        `$player.SoundLocation = '${file.replace(/'/g, "''")}'; ` +
        `$player.PlaySync(); $player.Dispose()`;
      await run(
        `powershell -NoProfile -NonInteractive -Command "${script.replace(/"/g, '\\"')}"`,
      );
    } else if (process.platform === 'darwin') {
      await run(`afplay '${file}'`);
    } else {
      // Linux: prefer paplay, fall back to aplay.
      try {
        await run(`paplay '${file}'`);
      } catch {
        await run(`aplay '${file}'`);
      }
    }
  } catch (error) {
    console.error('Failed to play audio:', error);
  }
}
