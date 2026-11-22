import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CommitTreeAdapter } from '../../src/adapters/git-source-history/CommitTreeAdapter';
import { SourceIndexService } from '../../src/services/development-tooling/source-index-service/SourceIndexService';
import { loadSide } from '../../src/workflows/development-tooling/loadRevisions';
import { componentVersion } from '../../src/utils/development-tooling/componentVersion';
import { UnitRegistryRepository } from '../../src/repositories/verification-evidence/UnitRegistryRepository';

/** Real registered source identity for synthetic media/parent integration fixtures; no browser or build. */
export async function videoReferenceOwner(root: string, git: (...args: string[]) => string) {
	const entry = 'src/components/verification-evidence/Player.svelte';
	await mkdir(join(root, 'src/components/verification-evidence'), { recursive: true });
	await writeFile(
		join(root, entry),
		'<!-- @harness-uid u_abcdefghij -->\n<div>synthetic media owner</div>\n'
	);
	await writeFile(
		join(root, 'specification/units/component.player.json'),
		JSON.stringify(ownerDeclaration(entry))
	);
	git('add', '.');
	git('commit', '-qm', 'feat: register synthetic video parent owner');
	const commit = git('rev-parse', 'HEAD'),
		tree = git('rev-parse', 'HEAD^{tree}');
	const side = await loadSide(
		root,
		await CommitTreeAdapter.open(root, commit),
		new SourceIndexService()
	);
	const manifest = side.manifests.find((unit) => unit.id === 'component.player');
	if (!manifest) {
		const registry = await new UnitRegistryRepository(root).read(
			await CommitTreeAdapter.open(root, commit)
		);
		throw new Error(
			`Synthetic video owner was not registered: ${registry.errors.join('; ')}; ids=${side.manifests.map((unit) => unit.id).join(',')}`
		);
	}
	return {
		commit,
		tree,
		components: [
			{
				...componentVersion(manifest, side.index.files),
				change: 'modified' as const,
				target: 'module' as const
			}
		]
	};
}

function ownerDeclaration(entry: string) {
	return {
		schemaVersion: 1,
		id: 'component.player',
		uid: 'u_abcdefghij',
		kind: 'component',
		title: 'Player',
		responsibility: 'Owns synthetic video integration evidence.',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [entry], symbols: ['Player'] },
		contract: {
			origin: 'declared',
			inputs: [],
			outputs: [],
			errors: [],
			errorStatus: 'declared',
			operations: [],
			initialization: []
		},
		dependencies: [],
		runtime: { kind: 'module', entry, targets: [{ kind: 'module', entry }] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	};
}
