import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import type { CacheStatus } from '../src/models/ProjectContext.types';
import { artifactLimit } from '../src/utils/artifactMedia';
import {
	asked,
	captureOf,
	evidence,
	hubFixture,
	notes,
	png,
	sha256
} from './hosted-evidence-fixture';
import { head } from './recorded-sample';

const refused = 'Hosted request failed or access was refused.';
const text = (value: string) => new TextEncoder().encode(value);
const html = text('<!doctype html><script>alert(1)</script>');
const large = new Uint8Array(artifactLimit + 1).fill(97);
/** The bytes with their last one changed. */
function damaged(bytes: Uint8Array): Uint8Array {
	const copy = new Uint8Array(bytes);
	copy[copy.length - 1] ^= 1;
	return copy;
}

test('a capture is asked for by its binding, checked, kept, and read again offline exactly as it was', async () => {
	const f = await hubFixture();
	try {
		const events: CacheStatus[] = [];
		const adapter = f.adapter(events);
		await adapter.evidence(asked);
		const shot = captureOf(png);
		const read = await adapter.artifact(shot);
		expect(read).toEqual({ bytes: png, mediaType: 'image/png', sha256: sha256(png) });
		const scope = `entityId=page.home&commit=${head}&branch=main&mode=commit`;
		const bound = `side=after&recordId=${shot.recordId}&scenarioId=home-page&state=filled&evidenceId=kept&sha256=${shot.sha256}`;
		const pinned = `viewport=desktop&notesRevision=${notes}&evidenceRevision=${evidence}`;
		expect(f.state.seen.at(-1)!.url).toBe(`/api/projects/p/artifact?${scope}&${bound}&${pinned}`);
		expect(f.routes().slice(2)).toEqual(['/api/auth/status', '/api/projects/p/artifact']);
		const kept = events.at(-1)!;
		expect(kept).toEqual({ projectId: 'p', status: 'fresh', cachedAt: expect.any(String) });
		await f.close();
		expect(await f.adapter(events).artifact(shot)).toEqual(read);
		expect(events.at(-1)).toEqual({ projectId: 'p', status: 'offline', cachedAt: kept.cachedAt });
		// Another binding is never answered from it: each part of it is part of the key.
		const others = [
			{ side: 'before' as const },
			{ viewport: null },
			{ state: 'empty' },
			{ recordId: '9'.repeat(64) },
			{ scenarioId: 'feed-run' },
			{ evidenceId: 'other' },
			{ notesRevision: null },
			{ evidenceRevision: 'f'.repeat(40) },
			{ mode: 'current' as const },
			{ projectId: 'q' }
		];
		for (const other of others)
			await expect(adapter.artifact({ ...shot, ...other })).rejects.toThrow(refused);
	} finally {
		await f.cleanup();
	}
});

test('each kind of file this app shows is read under the media type the hub attested', async () => {
	const f = await hubFixture();
	try {
		const adapter = f.adapter();
		const shown: Array<[Uint8Array, string, string]> = [
			[text('{"ok":true}'), 'application/json', 'application/json'],
			[text('{"ok":true}'), 'text/plain; charset=utf-8', 'text/plain; charset=utf-8'],
			[html, 'text/plain;charset=UTF-8', 'text/plain; charset=utf-8']
		];
		for (const [bytes, sent, served] of shown) {
			f.state.artifact = { bytes, mediaType: sent };
			expect(await adapter.artifact(captureOf(bytes))).toEqual({
				bytes,
				mediaType: served,
				sha256: sha256(bytes)
			});
		}
	} finally {
		await f.cleanup();
	}
});

test.each([
	[
		'bytes that changed on the way',
		png,
		{ bytes: damaged(png), mediaType: 'image/png' },
		/SHA-256/
	],
	['another file than the one asked for', png, { bytes: html, mediaType: 'text/plain' }, /SHA-256/],
	['markup', html, { bytes: html, mediaType: 'text/html' }, /does not show/],
	['markup said to be an image', html, { bytes: html, mediaType: 'image/png' }, /does not show/],
	[
		'an image said to be a script',
		png,
		{ bytes: png, mediaType: 'text/javascript' },
		/does not show/
	],
	['one byte more than 11 MiB', large, { bytes: large, mediaType: 'text/plain' }, /11 MiB/]
] as const)('%s is refused and never kept', async (_name, wanted, sent, words) => {
	const f = await hubFixture();
	try {
		const adapter = f.adapter();
		await adapter.evidence(asked);
		const before = await f.files();
		expect(before).toHaveLength(2);
		const shot = captureOf(wanted);
		f.state.artifact = sent;
		await expect(adapter.artifact(shot)).rejects.toThrow(words);
		expect(await f.files()).toEqual(before);
		await f.close();
		await expect(adapter.artifact(shot)).rejects.toThrow(refused);
	} finally {
		await f.cleanup();
	}
});

test('a kept capture that was changed where it is kept is discarded, not served', async () => {
	const f = await hubFixture();
	try {
		const adapter = f.adapter();
		const answer = await adapter.evidence(asked);
		const before = await f.files();
		const shot = captureOf(png);
		await adapter.artifact(shot);
		const own = (await f.files()).filter((name) => !before.includes(name));
		expect(own.map((name) => name.split('-')[0])).toEqual(['lookup', 'projection']);
		const path = join(f.directory, own[1]);
		const entry = JSON.parse(await readFile(path, 'utf8'));
		const changed = Buffer.from(damaged(Buffer.from(entry.bytes, 'base64'))).toString('base64');
		await writeFile(path, JSON.stringify({ ...entry, bytes: changed }));
		await f.close();
		await expect(adapter.artifact(shot)).rejects.toThrow(refused);
		// Both of its files are gone; what else is kept is untouched and still read.
		expect(await f.files()).toEqual(before);
		expect(await adapter.evidence(asked)).toEqual(answer);
		await expect(adapter.artifact(shot)).rejects.toThrow(refused);
	} finally {
		await f.cleanup();
	}
});
