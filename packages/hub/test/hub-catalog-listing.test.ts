import { writeCache } from 'collaboration';
import { test } from 'vitest';
import { expect } from '../../../test/verificationExpect';
import {
	analytics,
	charted,
	former,
	idsOf,
	loaders,
	manifest,
	ordinary,
	rendered,
	twin
} from '../../desktop/test/catalog-listing-manifests';
import type { Listing } from '../../desktop/test/catalog-listing-manifests';
import { hubHash } from '../src/utils/hubJson';
import { actor, commit, project, projectionFixture, unit } from './support/projectionFixture';

/**
 * What the hosted workspace lists of a commit: as the computer does, no page manifest that only
 * loads for an address there, by what it owns in the tree of that commit and nothing else. It
 * is still opened by its identity, and a snapshot cached before this rule is not what is shown.
 */
const branch = 'feat/a/b';
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const ids = (entities: { id: string }[]) => entities.map((entity) => entity.id).sort();
const tip = [...loaders, ...ordinary, twin];

/** A hosted project whose source tree holds these manifests and every file they own. */
function hosted(listings: Listing[]) {
	const f = projectionFixture();
	for (const listing of listings) {
		f.files.set(`specification/units/${listing[0]}.json`, encode(manifest(listing)));
		for (const path of listing[3]) f.files.set(path, new TextEncoder().encode(`// ${listing[0]}`));
	}
	return f;
}
const shown = (f: ReturnType<typeof hosted>) =>
	f.projection.snapshot(actor, project.id, { branch, commit: null });

test('the hosted catalog lists every ordinary entity and no page manifest that only loads for an address', async () => {
	const view = await shown(hosted(tip));
	expect(ids(view.entities)).toEqual([unit.id, ...idsOf([...ordinary, twin])].sort());
	// The twin has the title and the very sentence of the loader that is left out, and is a page.
	expect(view.entities.find((entity) => entity.id === twin[0])).toMatchObject({
		category: 'pages',
		title: '/analytics',
		summary: former
	});
});

test('what the hosted catalog leaves out is still opened by its identity, with its source and history', async () => {
	const f = hosted(tip);
	for (const [entityId, title, summary, sources] of loaders) {
		const detail = await f.projection.entity(actor, project.id, { entityId, commit, branch });
		expect(detail).toMatchObject({ id: entityId, title, summary, category: 'pages', sources });
		expect(detail.history.map((entry) => entry.commit)).toEqual([commit]);
		const read = await f.projection.source(actor, project.id, {
			entityId,
			commit,
			path: sources[0]
		});
		expect(read.text).toBe(`// ${entityId}`);
	}
});

test('the same identity is listed in the tree of the commit where it renders, as it is there', async () => {
	const earlier = await shown(hosted([rendered, ...ordinary]));
	expect(earlier.entities.find((entity) => entity.id === analytics)).toMatchObject({
		category: 'pages',
		summary: charted
	});
	expect(ids((await shown(hosted(tip))).entities)).not.toContain(analytics);
});

test('a snapshot that was cached with a loader listed is not what the hosted catalog shows', async () => {
	const fresh = await shown(hosted(tip));
	const stale = {
		...fresh.entities[0],
		id: analytics,
		category: 'pages',
		kind: 'page',
		title: '/analytics',
		summary: 'Cached by the earlier listing.'
	};
	const entities = [...fresh.entities.filter((entity) => entity.id !== analytics), stale];
	// The profile the snapshot of a commit was cached under before the list left loaders out.
	const branches = await hubHash(encode([{ name: branch, tip: commit }]));
	const profile = 'projection:' + (await hubHash(`snapshot:${branches}`));
	const again = hosted(tip);
	const identity = { ...fresh.cache!.identity, artifactHash: null, profile };
	await writeCache(again.cache, identity, encode({ ...fresh, entities }));
	expect((await shown(again)).entities.find((entity) => entity.id === analytics)).toBeUndefined();
});
