import { expect } from '../../../test/verificationExpect';
import { test, vi } from 'vitest';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { fixture, git } from './project-fixture';

/**
 * One entity request reads the complete planning snapshot of its revision once, and its listing
 * and its plan come from that one read. Nothing is kept between requests: the next one reads again.
 */
async function planned() {
	const f = await fixture();
	const plan = await f.planning.createPlan({ category: 'pages', title: 'Proposal', goal: 'Page' });
	const draft = {
		...{ entityId: plan.id, prompt: 'Image proposal', baseRevision: f.tip, state: 'default' },
		generator: { provider: 'codex' as const, model: 'fixture' },
		...{ viewport: 'desktop', bytes: PNG.sync.write(new PNG({ width: 2, height: 2 })) }
	};
	const design = await f.planning.addDesign(draft);
	const [image] = design.images;
	await f.planning.openThread({
		...{ entityId: plan.id, version: design.version, imageSha256: image.sha256 },
		...{ state: 'default', viewport: 'desktop', region: null }
	});
	const record = await f.planning.plans(git(f.root, 'rev-parse', 'HEAD'));
	const contractHash = record.find((p) => p.id === plan.id)!.contract.hash!;
	const imageHashes = [image.sha256];
	await f.planning.approve({
		entityId: plan.id,
		version: design.version,
		imageHashes,
		contractHash
	});
	return { ...f, plan, draft, design, head: git(f.root, 'rev-parse', 'HEAD') };
}

test('an entity request reads the planning snapshot once and shows the plan of that read', async () => {
	const f = await planned();
	const held = (await f.planning.plans(f.head)).find((p) => p.id === f.plan.id)!;
	const reads = vi.spyOn(f.planning, 'plans');
	const detail = await f.catalog.entity(f.plan.id, f.head);
	const home = await f.catalog.entity('page.home', f.head);
	expect(detail).toMatchObject({ id: held.id, planned: true, approvedVersion: f.design.version });
	expect(detail).toMatchObject({ contract: held.contract, versions: held.versions });
	expect([detail.threads, detail.threads.length]).toEqual([held.threads, 1]);
	expect(detail.history.map((h) => h.commit)).toContain(f.head);
	expect(home).toMatchObject({ versions: [], threads: [], sources: ['src/pages/Home.ts'] });
	// One complete read for each of the two requests.
	expect(reads.mock.calls).toEqual([[f.head], [f.head]]);
}, 60000);

test('each request reads again, so a design saved between two requests is in the second', async () => {
	const f = await planned();
	const reads = vi.spyOn(f.planning, 'plans');
	const first = await f.catalog.entity(f.plan.id, f.head);
	await f.planning.addDesign({ ...f.draft, prompt: 'Second proposal', baseRevision: f.head });
	const latest = git(f.root, 'rev-parse', 'HEAD');
	const second = await f.catalog.entity(f.plan.id, latest);
	const again = await f.catalog.entity(f.plan.id, f.head);
	expect(second.versions.map((v) => v.version)).toEqual([f.design.version, 'v002']);
	expect([second.approvedVersion, second.versions[0].approval?.current]).toEqual([null, false]);
	expect(again).toEqual(first);
	expect(reads.mock.calls).toEqual([[f.head], [latest], [f.head]]);
}, 60000);

test('an entity that is not held and a corrupt plan fail as they did, after one read', async () => {
	const f = await planned();
	const reads = vi.spyOn(f.planning, 'plans');
	const missing = f.catalog.entity('page.never-held', f.head);
	await expect(missing).rejects.toThrow('Entity not found at this revision.');
	await mkdir(join(f.root, 'src/functions/broken'), { recursive: true });
	await writeFile(join(f.root, 'src/functions/broken/plan.json'), '{');
	git(f.root, 'add', '.');
	git(f.root, 'commit', '-m', 'corrupt plan');
	const broken = git(f.root, 'rev-parse', 'HEAD');
	const corrupt = f.catalog.entity(f.plan.id, broken);
	await expect(corrupt).rejects.toThrow(/^src\/functions\/broken\/plan\.json: /);
	expect(reads.mock.calls).toEqual([[f.head], [broken]]);
}, 60000);

test('local entity documents follow committed Git history and ignore uncommitted edits', async () => {
	const f = await fixture();
	const file = join(f.root, 'specification/units/function.filter.json');
	const manifest = JSON.parse(await readFile(file, 'utf8'));
	const path = 'usage.md';
	const doc = (name: string) =>
		'# Usage\n```harness-examples\n' +
		JSON.stringify({
			schemaVersion: 1,
			unitId: manifest.id,
			examples: [{ name, input: false, output: 0 }]
		}) +
		'\n```';
	await writeFile(file, JSON.stringify({ ...manifest, documentation: path }));
	await writeFile(join(f.root, path), doc('First use'));
	git(f.root, 'add', '.');
	git(f.root, 'commit', '-m', 'committed usage');
	const before = git(f.root, 'rev-parse', 'HEAD');
	await writeFile(join(f.root, path), doc('Second use'));
	git(f.root, 'add', '.');
	git(f.root, 'commit', '-m', 'revised usage');
	const after = git(f.root, 'rev-parse', 'HEAD');
	await writeFile(join(f.root, path), doc('Uncommitted use'));
	const first = await f.catalog.entity(manifest.id, before);
	const second = await f.catalog.entity(manifest.id, after);
	expect(first.documentation?.examples[0].name).toBe('First use');
	expect(second.documentation?.examples[0].name).toBe('Second use');
	expect(second.history.map((entry) => entry.commit)).toContain(after);
	expect(second.documentation?.text).not.toContain('Uncommitted use');
}, 60000);

test('page API relationships follow transitive requests at the selected committed revision', async () => {
	const f = await fixture();
	const read = async (id: string) =>
		JSON.parse(await readFile(join(f.root, `specification/units/${id}.json`), 'utf8'));
	const home = await read('page.home');
	const service = await read('service.analytics');
	const endpoint = {
		...service,
		id: 'endpoint.orders',
		kind: 'endpoint',
		title: '/api/orders',
		owns: { source: ['src/routes/api/orders/+server.ts'], symbols: ['GET'] },
		dependencies: [{ unit: service.id, via: 'import', origin: 'declared' }]
	};
	const write = (unit: typeof home) =>
		writeFile(join(f.root, `specification/units/${unit.id}.json`), JSON.stringify(unit));
	await mkdir(join(f.root, 'src/routes/api/orders'), { recursive: true });
	await writeFile(
		join(f.root, endpoint.owns.source[0]),
		'export function GET() { return new Response("orders"); }'
	);
	await write(endpoint);
	await write({
		...service,
		dependencies: [{ unit: endpoint.id, via: 'http', origin: 'derived' }]
	});
	await write({ ...home, dependencies: [{ unit: service.id, via: 'import', origin: 'derived' }] });
	git(f.root, 'add', '.');
	git(f.root, 'commit', '-m', 'feat: page requests orders through its service');
	const selected = git(f.root, 'rev-parse', 'HEAD');
	await write({ ...home, dependencies: [] });
	const before = await f.catalog.entity(home.id, f.tip);
	const after = await f.catalog.entity(home.id, selected);
	expect(before.relationships.filter((item) => item.category === 'apis')).toEqual([]);
	expect(after.relationships).toContainEqual(
		expect.objectContaining({ id: endpoint.id, category: 'apis', direction: 'uses' })
	);
	expect(await f.catalog.entity(endpoint.id, selected)).toMatchObject({
		category: 'apis',
		title: '/api/orders'
	});
}, 60000);
