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
      // SoundPlayer only supports WAV; use mciSendString (winmm.dll) for MP3.
      const psScript = [
        `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;using System.Text;public class W{[DllImport("winmm.dll",CharSet=CharSet.Auto,EntryPoint="mciSendString")]public static extern int m(string c,StringBuilder r,int l,IntPtr h);}'`,
        `$b = New-Object System.Text.StringBuilder(256)`,
        `$f = '${file.replace(/'/g, "''")}'`,
        `$r = [W]::m("open \`"$f\`" type mpegvideo alias p", $b, 256, [IntPtr]::Zero)`,
        `if ($r -ne 0) { throw "MCI open failed: $r" }`,
        `[W]::m("play p wait", $b, 256, [IntPtr]::Zero) | Out-Null`,
        `[W]::m("close p", $b, 256, [IntPtr]::Zero) | Out-Null`,
      ].join('\n');
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      await run(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`);
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
