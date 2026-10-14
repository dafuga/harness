import { expect } from '../../../../test/verificationExpect';
import { test } from 'vitest';
import { actor, commit, project } from '../support/projectionFixture';
import { headlessFixture, notes } from '../support/headlessFixture';

/**
 * A hosted headless plan reads as notes and cases: no image and no design option, its notes as
 * committed, and an approval only of exactly those notes under its contract. SYNTHETIC records
 * written by the real planning package and read through the hosted projection.
 */
const entity = (f: Awaited<ReturnType<typeof headlessFixture>>) =>
	f.projection.entity(actor, project.id, { entityId: f.unitId, commit, branch: 'main' });

test('a headless version keeps its notes, has no image or option, and its approval is current', async () => {
	const f = await headlessFixture();
	const read = await entity(f);
	const [only] = read.versions;
	expect(only.images).toEqual([]);
	expect(only.options).toBeUndefined();
	expect(only.notes).toBe(notes);
	expect(only.approval).toMatchObject({
		...{ version: 'v001', imageHashes: [], current: true },
		contractHash: f.stored.contractHash
	});
	expect(only.approval?.option).toBeUndefined();
	expect(read.lifecycle).toBe('approved');
}, 30_000);

test('an approval of other notes approves nothing', async () => {
	const f = await headlessFixture();
	for (const file of f.approvals)
		f.change(file, (value) => ({ ...value, notesSha256: 'f'.repeat(64) }));
	const read = await entity(f);
	expect(read.versions[0].approval).toBeNull();
	expect(read.lifecycle).toBe('review');
}, 30_000);
