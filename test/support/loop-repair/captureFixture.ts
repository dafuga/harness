import { EvidenceTreeAdapter } from '../../../src/adapters/EvidenceTreeAdapter';
import { RegressionProofRepository } from '../../../src/repositories/RegressionProofRepository';
import { sourceArchiveRef } from '../../../src/utils/historyRefs';
import { ScenarioRepository } from '../../../src/repositories/ScenarioRepository';
import { UnitRegistryRepository } from '../../../src/repositories/UnitRegistryRepository';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { runCommand, runHarness } from '../cli';

/** Squash landing preserves identical pixels with their original revision, never a new verdict. */
export async function expectSquashedScreens(root: string, source: string): Promise<void> {
	const tree = (await runCommand(['git', 'rev-parse', source + '^{tree}'], root)).stdout.trim();
	const parent = (await runCommand(['git', 'rev-parse', source + '^'], root)).stdout.trim();
	const squash = (
		await runCommand(
			[
				'git',
				'-c',
				'user.name=Fixture',
				'-c',
				'user.email=fixture@harness.invalid',
				'commit-tree',
				tree,
				'-p',
				parent,
				'-m',
				'fix: squash source-identical repair'
			],
			root
		)
	).stdout.trim();
	await runCommand(['git', 'update-ref', 'refs/heads/squashed', squash], root);
	const out = join(root, 'squashed-history');
	await runHarness(['history', 'build', '--out', out, '--limit', '10'], root);
	const detail = JSON.parse(await readFile(join(out, 'revisions', squash + '.json'), 'utf8'));
	expect(detail.records).toEqual([]);
	expect(detail.regressions, 'source-identical squash retains focused screenshots').toContainEqual(
		expect.objectContaining({
			green: expect.objectContaining({
				commit: source,
				sourceTree: tree,
				captures: expect.arrayContaining([expect.objectContaining({ unit: 'page.sample' })])
			})
		})
	);
	await expectArchivedProof(root, source, squash, parent);
}

/** Both explicit unit names and canonical scenario slots use the same standard proof fixture. */
export async function captureFixture(root: string): Promise<string> {
	await new UnitRegistryRepository(root).write([
		{
			schemaVersion: 1,
			id: 'function.sample',
			kind: 'function',
			title: 'Sample value',
			responsibility: 'Supplies the synthetic selected fixture value.',
			responsibilityOrigin: 'declared',
			status: 'active',
			owns: { source: ['source.ts'], symbols: ['value'] },
			contract: {
				origin: 'declared',
				inputs: [],
				outputs: [{ name: 'value', type: 'number', description: 'Selected synthetic value.' }],
				errors: []
			},
			dependencies: [],
			runtime: {
				kind: 'module',
				entry: 'source.ts',
				targets: [{ kind: 'module', entry: 'source.ts' }]
			},
			scenarios: ['sample-screen'],
			budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
		}
	]);
	await new ScenarioRepository(root).write({
		schemaVersion: 1,
		id: 'sample-screen',
		title: 'Synthetic visual fixture',
		kind: 'ui',
		units: ['function.sample'],
		states: [{ id: 'overview', title: 'Overview', coverage: 'required' }],
		viewports: [{ id: 'desktop', width: 1, height: 1 }],
		tests: [{ id: 'page', kind: 'e2e', runner: 'command', target: 'bun proof.ts' }],
		evidence: [
			{
				id: 'sample-screen',
				kind: 'screenshot',
				states: ['overview'],
				viewports: ['desktop'],
				required: true
			}
		]
	});
	return proofScript;
}

const proofScript = `import { strict as assert } from 'node:assert'; import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'; import { value } from './source';
const directory = process.env.HARNESS_EVIDENCE_DIR;
if (directory) {
 mkdirSync(directory, {recursive:true});
 writeFileSync(directory+'/sample.json', JSON.stringify({measurements:[{unit:'function.sample', metric:'latency-warm-ms', unitOfMeasure:'ms', value:0.5, workload:'sample', method:'Synthetic fixture timing.'}]}));
 writeFileSync(directory+'/page.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMQUDAAAACkAGE0Zn1yAAAAAElFTkSuQmCC', 'base64'));
 const screen={evidence:'page.sample',kind:'screenshot',state:'overview',viewport:'desktop',file:'page.png',mediaType:'image/png',provenance:'fixture',server:{buildId:'fixture',revision:process.env.HARNESS_VERIFY_REVISION}};
 writeFileSync(directory+'/slot.png', readFileSync(directory+'/page.png'));
 writeFileSync(directory+'/captures.ndjson', [JSON.stringify({evidence:'sample', kind:'benchmark', state:'sample', file:'sample.json', mediaType:'application/json'}),JSON.stringify(screen),JSON.stringify({...screen,evidence:'sample-screen',file:'slot.png'})].join('\\n')+'\\n');
}
assert.equal(value, 3);`;

/** Whole-tree equality, validated archive names and original checkpoint identity stay explicit. */
async function expectArchivedProof(root: string, source: string, squash: string, parent: string) {
	const tree = new EvidenceTreeAdapter(root),
		proofs = new RegressionProofRepository(root);
	expect(
		(await proofs.latest('repair', 'green', squash))?.commit,
		'source-identical history must retain the original sealed checkpoint'
	).toBe(source);
	const changed = await tree.commit({
		parents: [parent],
		message: 'chore: unrelated changed tree',
		files: [{ path: 'checkpoint.md', content: { bytes: 'foreign tree' } }]
	});
	expect(await proofs.latest('repair', 'green', changed)).toBeUndefined();
	const origin = await tree.commit({
		parents: [source],
		message: 'chore: retain proof bookkeeping',
		files: [{ path: 'checkpoint.md', content: { bytes: 'bookkeeping tree' } }]
	});
	const files = [...(await tree.list(origin))].map(([path, blob]) => ({ path, content: { blob } }));
	const landed = await tree.commit({
		parents: [parent],
		files,
		message: 'chore: collapse same complete source'
	});
	expect(await tree.git.run(['rev-parse', `${landed}^{tree}`])).toBe(
		await tree.git.run(['rev-parse', `${origin}^{tree}`])
	);
	await tree.git.run(['update-ref', sourceArchiveRef('f'.repeat(40)), origin]);
	expect(
		await proofs.latest('repair', 'green', landed),
		'a mismatched archive name grants no lineage'
	).toBeUndefined();
	await tree.git.run(['update-ref', sourceArchiveRef(origin), origin]);
	expect(
		(await proofs.latest('repair', 'green', landed))?.commit,
		'an identical archived source retains its actual original green ancestor'
	).toBe(source);
	const retained = await proofs.latest('repair', 'green', landed);
	expect((await proofs.load(retained!)).record.source.commit).toBe(source);
	expect(
		await proofs.latest('repair', 'green', changed),
		'a sibling changed tree cannot borrow that archive'
	).toBeUndefined();
}
