// End-to-end Edge TTS test: synthesize a short phrase and report audio bytes.
import { writeFileSync } from 'node:fs';
import { edgeTtsToBuffer } from '../out/tts/edge.js';

const text = 'Hello world. 你好世界。';
const buf = await edgeTtsToBuffer(text, 'zh-CN');
console.log('synthesized bytes:', buf.length);
const ok = buf.length > 1000 && buf[0] === 0xff && buf[1] === 0xfb; // MP3 frame sync
console.log('looks like MP3:', ok);
writeFileSync('/tmp/edge-test.mp3', Buffer.from(buf));
console.log('wrote /tmp/edge-test.mp3');
