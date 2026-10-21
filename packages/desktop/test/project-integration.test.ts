import { expect } from '../../../test/verificationExpect';
import { test } from 'vitest';
import { Buffer } from 'node:buffer';
import { PNG } from 'pngjs';
import { fixture, git, text } from './project-fixture';
test('project selection and slash branches retain full ancestry and explicit historical views are immutable', async () => {
	const f = await fixture();
	await git(f.root, ['remote', 'add', 'origin', 'git@github.com:fixture/orders.git']);
	const current = await f.session.snapshot({ branch: null, commit: null });
	expect(current.project.repositoryUrl).toBe('https://github.com/fixture/orders');
	expect(current.entities).toHaveLength(4);
	expect(current.entities.map((entity) => entity.id)).not.toContain('function.filter');
	expect(current.branches.map((b) => b.name)).toContain('feature/design');
	expect(current.commits.map((c) => c.hash)).toEqual([f.tip, f.base]);
	expect(current.writable).toBe(true);
	expect((await f.session.mutable()).root).toBe(f.root);
	const explicit = await f.session.snapshot({ branch: 'main', commit: f.tip });
	expect(explicit.revision.atTip).toBe(true);
	expect(explicit.writable).toBe(false);
	await expect(f.session.mutable()).rejects.toThrow('read-only');
	const branch = await f.session.snapshot({ branch: 'feature/design', commit: null });
	expect(branch.revision.commit).toBe(f.feature);
	expect(branch.writable).toBe(false);
	await expect(f.session.mutable()).rejects.toThrow();
	await expect(f.session.snapshot({ branch: 'main', commit: f.feature })).rejects.toThrow(
		'ancestry'
	);
	const other = await fixture();
	await other.planning.createPlan({
		category: 'functions',
		title: 'Other only',
		goal: 'Other repository'
	});
	await f.session.open(other.root);
	expect(f.session.requireProject().root).toBe(other.root);
	const selected = await f.session.snapshot({ branch: null, commit: null });
	expect(selected.project.repositoryUrl).toBeUndefined();
	expect(selected.entities.map((e) => e.id)).toContain('function.other-only');
	await f.session.open(f.root);
	const original = await f.session.snapshot({ branch: null, commit: null });
	expect(original.entities.map((e) => e.id)).not.toContain('function.other-only');
}, 15000);
test('catalog shows source size and relationships without leaking source bodies or inventing verification', async () => {
	const f = await fixture();
	const catalog = await f.catalog.list(f.tip);
	expect(catalog.map((e) => e.category).sort()).toEqual(
		'components configs pages services'.split(' ')
	);
	expect(catalog.every((e) => e.verification === 'unknown')).toBe(true);
	expect(catalog.find((e) => e.id === 'function.filter')).toBeUndefined();
	expect((await f.catalog.entity('function.filter', f.tip)).changed).toBe(true);
	expect(catalog.find((e) => e.id === 'page.home')?.changed).toBe(false);
	expect(JSON.stringify(catalog)).not.toContain('export const owned');
	expect(JSON.stringify(catalog)).not.toContain('PRIVATE_SOURCE_BODY');
	const detail = await f.catalog.entity('page.home', f.tip);
	expect(detail.sources).toEqual(['src/pages/Home.ts']);
	const size = (Buffer.byteLength(text) / 1024).toFixed(1) + ' KB';
	expect(detail.size).toEqual({ available: true, text: size });
	expect(detail.performance.available).toBe(false);
	expect(detail.relationships).toEqual([
		expect.objectContaining({ id: 'function.filter', direction: 'uses', verification: 'unknown' })
	]);
	expect((await f.catalog.entity('function.filter', f.tip)).relationships).toEqual([
		expect.objectContaining({ id: 'page.home', direction: 'used-by' })
	]);
	expect(JSON.stringify(detail)).not.toContain(text);
	const unit = (await f.source.units(f.tip)).find((u) => u.id === 'page.home')!;
	expect((await f.source.source(unit, f.tip, 'src/pages/Home.ts')).text).toBe(text);
	await expect(f.source.source(unit, f.tip, 'private.txt')).rejects.toThrow('outside');
	await expect(f.source.source(unit, f.tip, '../private.txt')).rejects.toThrow();
	const component = (await f.source.units(f.tip)).find((u) => u.id === 'reports.component.select')!;
	expect((await f.source.source(component, f.feature, 'src/components/Select.ts')).text).toBe(
		'feature branch source'
	);
	expect((await f.source.source(component, f.base, 'src/components/Select.ts')).text).toBe(text);
}, 15000);
test('planning drafts stay separate from canonical registry and immutable approvals bind only their original version', async () => {
	const f = await fixture();
	const plan = await f.planning.createPlan({
		category: 'pages',
		title: 'Proposal',
		goal: 'Propose page'
	});
	expect((await f.source.units(git(f.root, 'rev-parse', 'HEAD'))).map((u) => u.id)).not.toContain(
		plan.id
	);
	expect(plan.lifecycle).toBe('draft');
	expect((await f.catalog.entity(plan.id, git(f.root, 'rev-parse', 'HEAD'))).verification).toBe(
		'unverified'
	);
	const bytes = PNG.sync.write(new PNG({ width: 2, height: 2 }));
	const draft = {
		entityId: plan.id,
		prompt: 'Image proposal',
		generator: { provider: 'codex' as const, model: 'fixture' },
		baseRevision: f.tip,
		state: 'default',
		viewport: 'desktop',
		bytes
	};
	const first = await f.planning.addDesign(draft);
	const current = (await f.planning.plans(git(f.root, 'rev-parse', 'HEAD'))).find(
		(p) => p.id === plan.id
	)!;
	const approval = await f.planning.approve({
		entityId: plan.id,
		version: first.version,
		imageHashes: first.images.map((i) => i.sha256),
		contractHash: current.contract.hash!
	});
	const approved = git(f.root, 'rev-parse', 'HEAD');
	expect(approval.current).toBe(true);
	await f.planning.addDesign({ ...draft, prompt: 'Second proposal', baseRevision: approved });
	const latest = git(f.root, 'rev-parse', 'HEAD');
	const detail = await f.catalog.entity(plan.id, latest);
	expect(detail).toMatchObject({ planned: true, verification: 'unverified' });
	expect(detail.approvedVersion).toBeNull();
	expect(detail.versions[0].approval?.current).toBe(false);
	expect((await f.catalog.entity(plan.id, approved)).approvedVersion).toBe(first.version);
	expect(
		await f.planning.image({
			entityId: plan.id,
			version: first.version,
			sha256: first.images[0].sha256,
			revision: approved
		})
	).toEqual(new Uint8Array(bytes));
	expect((await f.planning.history(plan.id, latest)).every((e) => e.commit !== f.base)).toBe(true);
}, 20000);
test('existing canonical entities gain bound plans without duplicate draft identities', async () => {
	const f = await fixture();
	const unit = (await f.source.units(f.tip)).find((u) => u.id === 'reports.component.select')!;
	const plan = await f.planning.ensurePlan(unit);
	expect(plan.id).toBe(unit.id);
	expect((await f.planning.ensurePlan(unit)).id).toBe(unit.id);
	const thread = await f.planning.openThread({
		entityId: unit.id,
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	});
	expect(thread.version).toBeNull();
	const tip = git(f.root, 'rev-parse', 'HEAD');
	const entities = await f.catalog.list(tip);
	expect(entities).toHaveLength(4);
	expect(entities.filter((e) => e.id === unit.id)).toHaveLength(1);
	expect(entities.find((e) => e.id === unit.id)).toMatchObject({
		planned: false,
		hasPlan: true,
		lifecycle: 'draft',
		verification: 'unknown',
		threadCount: 1
	});
	expect((await f.source.units(tip)).map((u) => u.id)).toEqual(
		(await f.source.units(f.tip)).map((u) => u.id)
	);
}, 15000);
