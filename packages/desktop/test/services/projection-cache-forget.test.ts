import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import type { CacheIdentity } from '../../../collaboration/src/models/Collaboration.types';
import { ProjectionCacheService } from '../../src/services/projection-cache-service/ProjectionCacheService';

const identity: CacheIdentity = {
	collaborationRevision: null,
	principalId: 'alice',
	projectId: 'p',
	repositoryId: 7,
	requestedRef: 'main',
	sourceCommit: 'a'.repeat(40),
	sourceTree: 'b'.repeat(40),
	notesRef: 'refs/notes/harness',
	notesRevision: 'c'.repeat(40),
	evidenceRef: 'refs/heads/harness-evidence',
	evidenceRevision: 'd'.repeat(40),
	historyIndexRevision: null,
	artifactHash: null,
	profile: null
};
const moved = { ...identity, notesRevision: 'f'.repeat(40) };

let root: string;
let cache: ProjectionCacheService;
beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), 'projection-forget-'));
	cache = new ProjectionCacheService(root);
});
afterEach(() => rm(root, { recursive: true, force: true }));
/** The kinds of the kept files, in order: one lookup and one projection for each kept scope. */
const kinds = async () => (await readdir(root)).sort().map((name) => name.split('-')[0]);
const pair = ['lookup', 'projection'];
const pairs = ['lookup', 'lookup', 'projection', 'projection'];

test('a scope keeps one copy: what it remembers next replaces what it kept', async () => {
	await cache.remember('scope', identity, { text: 'first' });
	await cache.remember('scope', moved, { text: 'second' });
	expect(await cache.lookup('scope')).toMatchObject({ value: { text: 'second' }, identity: moved });
	expect(await kinds()).toEqual(pair);
	// Another value at the same identity replaces it as well; another scope is left alone.
	await cache.remember('other', identity, { text: 'kept' });
	await cache.remember('scope', moved, { text: 'third' });
	expect(await kinds()).toEqual(pairs);
	// What is remembered again as it is stays kept.
	await cache.remember('scope', moved, { text: 'third' });
	expect(await kinds()).toEqual(pairs);
	expect((await cache.lookup('scope'))?.value).toEqual({ text: 'third' });
	expect(await cache.lookup('other')).toMatchObject({ value: { text: 'kept' }, identity });
});

test('forgetting a scope removes its lookup and its projection, and nothing of another scope', async () => {
	await cache.remember('scope', identity, { text: 'first' });
	await cache.remember('other', identity, { text: 'kept' });
	await cache.discard('scope');
	expect(await cache.lookup('scope')).toBeNull();
	expect(await kinds()).toEqual(pair);
	expect((await cache.lookup('other'))?.value).toEqual({ text: 'kept' });
	// Forgetting what is not kept changes nothing and fails nothing.
	await cache.discard('scope');
	await cache.discard('never kept');
	expect(await kinds()).toEqual(pair);
	await new ProjectionCacheService(join(root, 'absent')).discard('scope');
});

test('a kept copy whose bytes were changed is let go of when it is looked up', async () => {
	await cache.remember('other', identity, { text: 'kept' });
	const before = await readdir(root);
	await cache.remember('scope', identity, { text: 'first' });
	const own = (await readdir(root)).filter((name) => !before.includes(name)).sort();
	const path = join(root, own[1]);
	const entry = JSON.parse(await readFile(path, 'utf8'));
	const changed = Buffer.from(JSON.stringify({ text: 'forged' })).toString('base64');
	await writeFile(path, JSON.stringify({ ...entry, bytes: changed }));
	expect(await cache.lookup('scope')).toBeNull();
	expect((await readdir(root)).sort()).toEqual(before.sort());
	expect((await cache.lookup('other'))?.value).toEqual({ text: 'kept' });
});
