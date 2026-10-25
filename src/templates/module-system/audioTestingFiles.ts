import { browserTestFiles } from '../development-tooling/browserTest';

/** Provider-free deterministic playout follows Nudge's queue/clear/WAV boundary. */
export const audioTestingFiles = [
	...browserTestFiles().map((file) => ({
		...file,
		path: file.path.replace('tests/e2e/support', 'tests/plugin-support')
	})),
	{
		path: 'src/configs/testing/audioPlaywrightConfig.ts',
		contents: `import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir: '../../../tests/audio',
 outputDir: '../../../test-results/audio',
 use: { headless: true, browserName: 'chromium' },
 workers: Number(process.env.HARNESS_RESOURCE_CPUS ?? 1),
 reporter: 'list'
});
`
	},
	{
		path: 'src/services/headless-audio/HeadlessAudioService.types.ts',
		contents: 'export interface AudioChunk { samples: Int16Array; offset: number; }\n'
	},
	{
		path: 'src/services/headless-audio/HeadlessAudioService.ts',
		contents: `import { Buffer } from 'node:buffer';
import type { AudioChunk } from './HeadlessAudioService.types';
/** Deterministic mono PCM16 playout. No device, wall clock, network or provider access. */
export class HeadlessAudioService {
 private queue: AudioChunk[] = [];
 private recording: Buffer[] = [];
 private playedFrames = 0;
 constructor(readonly sampleRate = 48000) {
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000)
   throw new Error('Unsupported sample rate.');
 }
 get playedMs(): number { return this.playedFrames * 1000 / this.sampleRate; }
 enqueue(samples: Int16Array): void {
  if (!(samples instanceof Int16Array)) throw new Error('Expected PCM16 samples.');
  if (samples.length) this.queue.push({ samples: samples.slice(), offset: 0 });
 }
 clear(): void { this.queue = []; }
 next(frames: number): Int16Array {
  if (!Number.isInteger(frames) || frames < 1 || frames > this.sampleRate * 60)
   throw new Error('Request between one frame and one minute.');
  const output = new Int16Array(frames);
  let offset = 0;
  while (this.queue.length && offset < frames) {
   const chunk = this.queue[0];
   const count = Math.min(frames - offset, chunk.samples.length - chunk.offset);
   output.set(chunk.samples.subarray(chunk.offset, chunk.offset + count), offset);
   offset += count; chunk.offset += count;
   if (chunk.offset === chunk.samples.length) this.queue.shift();
  }
  const bytes = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++) bytes.writeInt16LE(output[i], i * 2);
  this.recording.push(bytes); this.playedFrames += frames;
  return output;
 }
 wav(): Buffer {
  const data = Buffer.concat(this.recording);
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(data.length + 36, 4);
  header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(this.sampleRate, 24); header.writeUInt32LE(this.sampleRate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
 }
}
`
	}
];
