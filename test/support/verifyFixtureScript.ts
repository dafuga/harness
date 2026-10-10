/**
 * A synthetic "test" for the fixture project: a plain Node script that follows the evidence
 * protocol. Its images and audio are real, decodable PNG and WAV files with deterministic
 * content; FIXTURE_* variables make it misbehave on purpose for negative tests.
 */
export const fixtureScript = String.raw`
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';

const [mode, target] = process.argv.slice(2);
const env = process.env;
const dir = env.HARNESS_EVIDENCE_DIR;
const media = env.FIXTURE_MEDIA ?? '';
const read = (path) => readFileSync(path, 'utf8');
const sizes = { desktop: [1440, 900], tablet: [920, 800], mobile: [390, 844] };

function chunk(type, data) {
	const body = Buffer.concat([Buffer.from(type), data]);
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	body.copy(out, 4);
	out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
	return out;
}
function png(width, height, shade) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header[8] = 8;
	const row = Buffer.alloc(1 + width, shade);
	row[0] = 0;
	const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	return Buffer.concat([signature, chunk('IHDR', header), chunk('IDAT', pixels), chunk('IEND', Buffer.alloc(0))]);
}
function wav(seconds) {
	const rate = 8000;
	const data = Buffer.alloc(Math.round(rate * seconds) * 2);
	for (let index = 0; index < data.length / 2; index += 1) data.writeInt16LE(Math.round(8000 * Math.sin(index * 0.35)), index * 2);
	const header = Buffer.alloc(44);
	header.write('RIFF', 0);
	header.writeUInt32LE(36 + data.length, 4);
	header.write('WAVEfmt ', 8);
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(1, 22);
	header.writeUInt32LE(rate, 24);
	header.writeUInt32LE(rate * 2, 28);
	header.writeUInt16LE(2, 32);
	header.writeUInt16LE(16, 34);
	header.write('data', 36);
	header.writeUInt32LE(data.length, 40);
	return Buffer.concat([header, data]);
}
function capture(entry, bytes) {
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, entry.file), bytes);
	appendFileSync(join(dir, 'captures.ndjson'), JSON.stringify(entry) + '\n');
}
function image(viewport, shade) {
	const [width, height] = media === 'wrongsize' ? [100, 100] : sizes[viewport];
	const valid = png(width, height, shade);
	if (media === 'corrupt') return Buffer.from('this is not an image');
	if (media === 'wrongtype') return wav(0.25);
	return media === 'truncated' ? valid.subarray(0, Math.floor(valid.length / 2)) : valid;
}
function audio() {
	const valid = wav(0.25);
	if (media === 'audio-truncated') return valid.subarray(0, 200);
	return media === 'audio-corrupt' ? Buffer.from('RIFF fixture audio') : valid;
}
const server = { buildId: 'fixture-build', revision: env.FIXTURE_STALE_REVISION ?? env.HARNESS_VERIFY_REVISION };

if (mode === 'test') process.exit(read(target).includes('FAIL') ? 1 : 0);
const touch = (path, text) => (mkdirSync(dirname(path), { recursive: true }), writeFileSync(path, text));
if (mode === 'audio' && env.FIXTURE_ADD_EARLY) touch(env.FIXTURE_ADD_EARLY, 'added by an earlier check\n');
if (mode === 'page' && env.FIXTURE_MUTATE) touch(env.FIXTURE_MUTATE, 'mutated by a test\n');
if (mode === 'page' && env.FIXTURE_REMOVE) rmSync(env.FIXTURE_REMOVE, { force: true });
if (mode === 'page' && env.FIXTURE_RENAME) renameSync(...env.FIXTURE_RENAME.split(':'));
if (mode === 'page' && env.FIXTURE_HANG) {
	spawn(process.execPath, ['-e', 'setTimeout(() => require("fs").writeFileSync(process.argv[1], "late"), 1500)', env.FIXTURE_HANG], { stdio: 'ignore' });
	process.on('SIGTERM', () => {});
	setInterval(() => {}, 1000);
} else if (!dir || env.TAKE_SCREENSHOT !== '1') {
	process.exit(0);
} else if (mode === 'page') {
	const slug = ['src/utils/slugify.ts', 'src/core/slug.ts'].find((path) => existsSync(path));
	const content = read('src/routes/titles/+page.svelte') + read('src/services/TitleService.ts') + read(slug);
	const skip = (env.FIXTURE_SKIP ?? '').split(',');
	for (const state of ['empty', 'filled']) {
		for (const viewport of ['desktop', 'tablet', 'mobile']) {
			if (skip.includes(state + '-' + viewport)) continue;
			const file = state + '-' + viewport + '.png';
			const entry = { evidence: 'screens', kind: 'screenshot', state, viewport, file, mediaType: 'image/png' };
			const shade = (content.length + (state === 'empty' ? 0 : 97)) % 251;
			capture(env.FIXTURE_NO_STAMP ? entry : { ...entry, server }, image(viewport, shade));
		}
	}
	if (env.FIXTURE_FAIL) process.exit(1);
} else if (mode === 'audio') {
	const transcript = env.FIXTURE_NO_TRANSCRIPT ? undefined : 'Title: ' + read('src/services/TitleService.ts').length;
	const entry = { evidence: 'speech', kind: 'audio', state: 'spoken', file: 'spoken.wav', mediaType: 'audio/wav' };
	const durationSeconds = media === 'audio-duration' ? 9 : 0.25;
	capture({ ...entry, provenance: 'fixture', transcript, durationSeconds }, audio());
} else if (mode === 'clock') {
	capture({ evidence: 'output', kind: 'output', state: 'default', file: 'clock.txt', mediaType: 'text/plain' }, read('src/utils/clock.ts'));
} else if (mode === 'bench') {
	const cost = Number(/titleCost = ([\d.]+)/.exec(read('src/services/TitleService.ts'))[1]);
	const method = env.FIXTURE_BENCH_METHOD ?? 'Deterministic rule fixture: the value is declared in source and is not a timing.';
	const request = JSON.stringify({ input: { titles: Number(env.FIXTURE_BENCH_TITLES ?? 1000) }, operation: 'titles' });
	const digest = createHash('sha256').update(request).digest('hex');
	const comparison = { request: env.FIXTURE_BAD_CONTEXT ? 'titles-1k' : digest, boundary: 'fixture', protocol: 'declared-constant/1', sampling: { warmup: 0, rounds: 1, iterations: 1 } };
	const stated = { unit: 'service.title', metric: 'latency-warm-ms', unitOfMeasure: 'ms', value: cost, method, workload: 'titles-1k', target: 'module', samples: 1 };
	const unit = env.FIXTURE_BENCH_UNIT ? { unitOfMeasure: env.FIXTURE_BENCH_UNIT } : {};
	const measurement = { ...stated, ...unit, ...(env.FIXTURE_NO_CONTEXT ? {} : { comparison }) };
	const body = JSON.stringify({ measurements: env.FIXTURE_NO_BENCH ? [] : [measurement] });
	capture({ evidence: 'boundary', kind: 'benchmark', state: 'default', file: 'benchmark.json', mediaType: 'application/json' }, body);
}
`;
