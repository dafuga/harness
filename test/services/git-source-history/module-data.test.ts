import type { ModuleData } from '../../../src/services/git-source-history/ModuleDataService.types';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { EvidenceTreeAdapter } from '../../../src/adapters/verification-evidence/EvidenceTreeAdapter';
import { ModuleDataRepository } from '../../../src/repositories/git-source-history/ModuleDataRepository';
import { ModuleDataReviewRepository } from '../../../src/repositories/git-source-history/ModuleDataReviewRepository';
import { ModuleDataService } from '../../../src/services/git-source-history/ModuleDataService';
import { configureTestAuthor, unitProject } from '../../support/unitProject';
import { runCommand } from '../../support/cli';
import { expect, test } from 'vitest';
import { componentManifestSchema } from '../../../src/core/unitTypes';
import { revisionRegistry } from '../../../src/utils/revisionRegistry';
import { moduleRelationships } from '../../../src/services/git-source-history/module-data-service/moduleRelationships';
function declared(id: string, kind: string, source: string, dependencies: string[] = []) {
	return componentManifestSchema.parse({
		schemaVersion: 1,
		id,
		kind,
		title: id,
		responsibility: 'A source-bound graph fixture.',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [source], symbols: [] },
		contract: { origin: 'declared', inputs: [], outputs: [], errors: [] },
		dependencies: dependencies.map((unit) => ({ unit, via: 'import', origin: 'derived' })),
		runtime: { kind: 'module', entry: source, targets: [{ kind: 'module', entry: source }] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	});
}
test('committed relationships include transitive APIs, route layouts and cycles without rewriting raw edges', () => {
	const manifests = [
		declared('page.orders', 'page', 'src/routes/orders/+page.svelte', ['component.list']),
		declared('component.list', 'component', 'src/components/List.svelte', ['service.orders']),
		declared('service.orders', 'service', 'src/services/OrdersService.ts', [
			'endpoint.orders',
			'component.list'
		]),
		declared('layout.root', 'layout', 'src/routes/+layout.svelte', ['endpoint.session']),
		declared('endpoint.orders', 'endpoint', 'src/routes/api/orders/+server.ts'),
		declared('endpoint.session', 'endpoint', 'src/routes/api/session/+server.ts')
	];
	manifests[2].dependencies.push({ unit: 'endpoint.orders', via: 'contract', origin: 'declared' });
	const registry = revisionRegistry(manifests, []),
		before = JSON.stringify(registry);
	const projected = moduleRelationships(registry);
	expect(projected['page.orders'].apis).toEqual(['endpoint.session', 'endpoint.orders']);
	expect(projected['page.orders'].layouts).toEqual(['layout.root']);
	expect(projected['component.list'].apis).toEqual(['endpoint.orders']);
	expect(projected['endpoint.orders'].pages).toEqual(['page.orders']);
	expect(JSON.stringify(registry)).toBe(before);
	expect(
		registry.graph.edges.filter(
			(edge) => edge.from === 'unit:service.orders' && edge.to === 'unit:endpoint.orders'
		)
	).toHaveLength(2);
});

test('sync keeps immutable snapshots while advancing repaired module lookup paths', async () => {
	const project = await unitProject('lib');
	try {
		const { repository, identity, initial, reader } = await divergentModuleWriters(project);
		await new ModuleDataReviewRepository(project.root).write(identity, initial.data.declarations, {
			unit: 'service.title',
			reason: 'Review the exact historical title implementation.',
			metadata: { responsibility: 'Serve a reviewed title from this exact source.' }
		});
		await new ModuleDataService(project.root).validate({ write: true });
		await repository.sync('origin');
		await expect(
			reader.fetch('origin'),
			'Repaired lookup paths must sync without losing immutable snapshots'
		).resolves.toMatchObject({ remote: 'origin' });
		const repaired = await reader.read(await reader.identity('HEAD'));
		expect(
			repaired?.data.declarations.find((unit) => unit.id === 'service.title')?.responsibility
		).toBe('Serve a reviewed title from this exact source.');
		const tree = new EvidenceTreeAdapter(reader.root),
			tip = (await tree.tip(reader.ref))!;
		expect(await tree.read(tip, 'snapshots/unrelated/retained.json')).toEqual(
			Buffer.from('retained')
		);
		const paths = [...(await tree.list(tip)).keys()];
		expect(paths.some((path) => path.endsWith(`/${initial.data.digest}.json`))).toBe(true);
		expect(paths.some((path) => path.endsWith(`/${repaired!.data.digest}.json`))).toBe(true);
		await rejectProducerConflict(repository, reader, repaired!.data);
	} finally {
		await rm(join(project.root, '..'), { recursive: true, force: true });
	}
}, 180_000);

async function divergentModuleWriters(project: Awaited<ReturnType<typeof unitProject>>) {
	const git = (args: string[]) => runCommand(['git', ...args], project.root);
	await git(['init', '-b', 'main']);
	await configureTestAuthor(project.root);
	await project.write(
		'src/services/TitleService.ts',
		'export class TitleService { run() { return "Title"; } }'
	);
	await project.harness(['units', 'index', '--write']);
	await git(['add', '.']);
	await git(['commit', '-m', 'feat: declare title source']);
	await new ModuleDataService(project.root).validate({ write: true });
	const repository = new ModuleDataRepository(project.root),
		identity = await repository.identity('HEAD');
	const initial = (await repository.read(identity))!;
	const remote = join(project.root, '..', 'remote.git'),
		readerRoot = join(project.root, '..', 'reader');
	await git(['clone', '--bare', project.root, remote]);
	await git(['remote', 'add', 'origin', remote]);
	await git(['clone', remote, readerRoot]);
	const tree = new EvidenceTreeAdapter(readerRoot);
	await tree.git.run(['fetch', project.root, `${repository.ref}:${repository.ref}`]);
	await configureTestAuthor(readerRoot);
	const prior = (await tree.tip(repository.ref))!;
	const next = await tree.commit({
		parents: [prior],
		message: 'chore: preserve an independent snapshot',
		files: [{ path: 'snapshots/unrelated/retained.json', content: { bytes: 'retained' } }]
	});
	await tree.advance(repository.ref, next, prior);
	return { repository, identity, initial, reader: new ModuleDataRepository(readerRoot) };
}

async function rejectProducerConflict(
	repository: ModuleDataRepository,
	reader: ModuleDataRepository,
	data: ModuleData
) {
	const tree = new EvidenceTreeAdapter(reader.root),
		prior = (await tree.tip(reader.ref))!;
	const { digest: _digest, ...body } = globalThis.structuredClone(data);
	body.registry.units[0].responsibility =
		'Conflicting producer output with the same review inputs.';
	await repository.write({ ...body, digest: repository.digest(body) });
	await repository.sync('origin');
	await expect(reader.fetch('origin')).rejects.toThrow(/Conflicting immutable module metadata/);
	expect(await tree.tip(reader.ref)).toBe(prior);
}
