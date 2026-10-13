import { expect, test } from 'vitest';
import { artifactLimit, artifactMedia } from '../../src/utils/artifactMedia';

const bytes = (...parts: Array<number[] | string>) =>
	new Uint8Array(parts.flatMap((part) => [...Buffer.from(part as never)]));
const png = bytes([137, 80, 78, 71, 13, 10, 26, 10], 'IHDR');
const jpeg = bytes([0xff, 0xd8, 0xff, 0xe0], 'JFIF');
const wav = bytes('RIFF', [36, 0, 0, 0], 'WAVEfmt ');
const markup = bytes('<!doctype html><script>alert(1)</script>');
const text = 'text/plain; charset=utf-8';
const told = (kind: string, mediaType: string, body: Uint8Array) =>
	artifactMedia({ kind, mediaType }, body);

test('one artifact is at most 11 MiB', () => {
	expect(artifactLimit).toBe(11 * 1024 * 1024);
});

test('a screenshot is what its bytes are: a PNG or a JPEG, whatever it was recorded as', () => {
	expect(told('screenshot', 'image/png', png)).toBe('image/png');
	expect(told('screenshot', 'image/png', jpeg)).toBe('image/jpeg');
	expect(told('screenshot', 'text/html', png)).toBe('image/png');
	for (const body of [markup, wav, bytes('GIF89a'), bytes([137, 80, 78]), new Uint8Array()])
		expect(() => told('screenshot', 'image/png', body)).toThrow(/screenshot/);
});

test('audio keeps a recorded audio type only when its bytes are that audio', () => {
	const cases: Array<[string, Uint8Array, string]> = [
		['audio/wav', wav, 'audio/wav'],
		['audio/x-wav', wav, 'audio/wav'],
		['audio/mpeg', bytes('ID3', [4, 0]), 'audio/mpeg'],
		['audio/mpeg', bytes([0xff, 0xfb, 0x90]), 'audio/mpeg'],
		['audio/mp4', bytes([0, 0, 0, 32], 'ftypM4A '), 'audio/mp4'],
		['audio/ogg', bytes('OggS', [0]), 'audio/ogg']
	];
	for (const [recorded, body, served] of cases) expect(told('audio', recorded, body)).toBe(served);
	const refused: Array<[string, Uint8Array]> = [
		['audio/wav', markup],
		['audio/wav', bytes('RIFF', [0, 0, 0, 0], 'AVI ')],
		['audio/ogg', wav],
		['text/html', wav],
		['audio/flac', bytes('fLaC')],
		['application/octet-stream', wav]
	];
	for (const [recorded, body] of refused)
		expect(() => told('audio', recorded, body)).toThrow(/audio/);
});

test('a recorded result is JSON or plain text, and never anything a page would run', () => {
	const json = bytes('{"ok":true,"steps":["é"]}');
	for (const kind of ['output', 'assertions', 'trace']) {
		expect(told(kind, 'application/json', json)).toBe('application/json');
		expect(told(kind, 'application/json', bytes('{"ok":'))).toBe(text);
		expect(told(kind, 'text/plain', json)).toBe(text);
		expect(told(kind, 'text/html', markup)).toBe(text);
		expect(told(kind, 'application/javascript', bytes('alert(1)'))).toBe(text);
		expect(() => told(kind, 'text/plain', png)).toThrow(/not text/);
		expect(() => told(kind, 'text/plain', bytes('a', [0], 'b'))).toThrow(/not text/);
	}
});

test('no other kind of capture is served, and nothing is ever HTML', () => {
	for (const kind of ['benchmark', 'video', 'html', ''])
		expect(() => told(kind, 'application/json', bytes('{}'))).toThrow(/not served/);
	const kinds = ['screenshot', 'audio', 'output', 'assertions', 'trace', 'benchmark'];
	const types = ['text/html', 'image/svg+xml', 'application/xhtml+xml'];
	const served = (kind: string, recorded: string, body: Uint8Array) => {
		try {
			return told(kind, recorded, body);
		} catch {
			return 'refused';
		}
	};
	const all = kinds.flatMap((kind) =>
		types.flatMap((recorded) => [markup, png, wav].map((body) => served(kind, recorded, body)))
	);
	expect([...new Set(all)].sort()).toEqual(['image/png', 'refused', text]);
});
