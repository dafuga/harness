import { expect, test } from 'vitest';
import { BudgetService } from '../../../../src/services/budget-service/BudgetService';
import { revisionRegistry } from '../../../../src/utils/revision-registry/revisionRegistry';
import { hubEvidenceRegistry } from '../../src/utils/hub-evidence-revision/hubEvidenceRegistry';
import { hubPinnedSource } from '../../src/utils/hubPinnedSource';
import { evidenceFixture, sourceAt, refusal } from '../support/evidenceFixture';
import { blobId } from '../support/evidenceGit';
import { clock, json, page, scenarios, sourceFiles, units } from '../support/evidenceRecords';

test('the registry of a commit is what the pure registry gives for its manifests and blobs', async () => {
	const f = evidenceFixture();
	const { root, changed } = f.commits;
	const base = await sourceAt(f, changed);
	const files = f.git.commits.get(root)?.files as Map<string, Uint8Array>;
	const blobs = new Map([...files].map(([path, bytes]) => [path, blobId(bytes)]));
	const limits = new BudgetService().baselines([], units);
	const registry = await hubEvidenceRegistry(await hubPinnedSource(base, root));
	expect(registry).toEqual(revisionRegistry(units, scenarios, blobs, limits));
	expect(registry.units.map((unit) => unit.id)).toEqual([clock, page]);
	// A unit is another version where a file it owns changed, and the same where none did.
	const later = await hubEvidenceRegistry(base);
	const version = (of: typeof registry, id: string) =>
		of.units.find((unit) => unit.id === id)?.version;
	expect(version(later, page)).not.toBe(version(registry, page));
	expect(version(later, clock)).toBe(version(registry, clock));
});

test('a manifest that cannot be read is explicitly refused, and a commit without units says so', async () => {
	const f = evidenceFixture();
	const files = sourceFiles('broken');
	files.set('specification/units/page.broken.json', new TextEncoder().encode('{'));
	files.set('specification/scenarios/unreadable.json', json({ id: 'unreadable' }));
	const broken = f.git.commit('broken', files, [f.commits.tip]);
	const bare = f.git.commit('bare', new Map([['README.md', json('none')]]), [broken]);
	const base = await sourceAt(f, f.commits.changed);
	expect(await refusal(hubEvidenceRegistry(await hubPinnedSource(base, broken)))).toBe(
		'artifact-corrupt'
	);
	expect(await hubEvidenceRegistry(await hubPinnedSource(base, bare))).toMatchObject({
		available: false,
		gap: 'no unit registry is stored at this revision',
		units: []
	});
});
