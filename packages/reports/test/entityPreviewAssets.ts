import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { audioFixture } from './audioFixture';
import { stateRecord } from './entityPreviewData';
import { commits } from './entityUnits';
import { sourcePaths, sourceText } from './entitySourceFixture';

type Colour = [number, number, number];
const tints: Record<string, Colour> = { a: [36, 52, 71], b: [20, 39, 58], c: [16, 44, 52] };
const sizes: Record<string, [number, number]> = { desktop: [1440, 900], mobile: [390, 844] };

function crc(bytes: Buffer): number {
	let value = ~0;
	for (const byte of bytes) {
		value ^= byte;
		for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
	}
	return ~value >>> 0;
}

function chunk(kind: string, data: Buffer): Buffer {
	const body = Buffer.concat([Buffer.from(kind), data]);
	const [length, sum] = [Buffer.alloc(4), Buffer.alloc(4)];
	length.writeUInt32BE(data.length);
	sum.writeUInt32BE(crc(body));
	return Buffer.concat([length, body, sum]);
}

/** A drawn page: a bar, and the cards of the state, so that two states and commits look apart. */
function picture(width: number, height: number, tint: Colour, cards: number): Buffer {
	const rows = Buffer.alloc((width * 3 + 1) * height);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const bar = y < height * 0.09;
			const column = Math.floor((x / width) * 2);
			const row = Math.floor(((y - height * 0.16) / height) * 4);
			const inside =
				y > height * 0.16 && x % (width / 2) > 16 && (y - height * 0.16) % (height / 4) > 16;
			const card = inside && row >= 0 && row * 2 + column < cards;
			const lift = bar ? 28 : Number(card) * 16;
			const at = y * (width * 3 + 1) + 1 + x * 3;
			tint.forEach((part, channel) => (rows[at + channel] = part + lift));
		}
	}
	const header = Buffer.alloc(13);
	header.writeUInt32BE(width, 0);
	header.writeUInt32BE(height, 4);
	header.set([8, 2, 0, 0, 0], 8);
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const parts = [
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(rows)),
		chunk('IEND', Buffer.alloc(0))
	];
	return Buffer.concat([signature, ...parts]);
}

/** What a synthetic run states about itself, as a recorded behaviour artifact does. */
function run(state: string, kind: string) {
	const found = state === 'match' ? ['Order 1042 · Service call'] : [];
	return {
		scenario: 'Search across synthetic orders',
		environment: 'Bun · headless',
		fixture: 'Twelve synthetic orders',
		steps: [
			'Open the orders page',
			`Search ${state === 'match' ? 'SERVICE' : 'zzz'}`,
			'Read the list'
		],
		input: { searchText: state === 'match' ? 'SERVICE' : 'zzz' },
		output: kind === 'output' ? found : undefined,
		assertions: [
			{ name: state === 'match' ? 'Matching order is listed' : 'No order is listed', passed: true },
			{ name: 'The list it was given is unchanged', passed: true }
		],
		trace: [{ step: 2, took: '1 ms' }]
	};
}

/**
 * Writes the media of the synthetic history under a directory: a drawn screenshot for every
 * screenshot capture, a short tone a browser can play for every clip, and a stated run for
 * every other one. Returns the hash of each file by the
 * name its capture has, so that a page can be given captures whose hashes are those of its bytes.
 */
export function entityPreviewAssets(directory: string): Record<string, string> {
	mkdirSync(join(directory, 'media'), { recursive: true });
	const hashes: Record<string, string> = {};
	for (const commit of Object.values(commits)) {
		for (const path of sourcePaths) {
			const text = sourceText(commit, path);
			const hash = createHash('sha256').update(text).digest('hex');
			hashes[`source:${commit}:${path}`] = hash;
			writeFileSync(join(directory, `media/${hash}.txt`), text);
		}
	}
	for (const commit of Object.values(commits)) {
		const states = stateRecord(commit).scenarios.flatMap((scenario) => scenario.states);
		for (const state of states) {
			for (const capture of state.captures) {
				const [width, height] = sizes[capture.viewport ?? 'desktop'];
				const full = commit === commits.first ? 4 : 6;
				const cards = state.id === 'empty' ? 0 : full;
				const drawn = () => picture(width, height, tints[commit[0]], cards);
				const stated = () => Buffer.from(JSON.stringify(run(state.id, capture.kind), null, 2));
				const made = { screenshot: drawn, audio: () => audioFixture(2) }[capture.kind] ?? stated;
				const bytes = made();
				writeFileSync(join(directory, capture.media as string), bytes);
				hashes[capture.media as string] = createHash('sha256').update(bytes).digest('hex');
			}
		}
	}
	return hashes;
}
