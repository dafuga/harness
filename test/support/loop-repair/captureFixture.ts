import { ScenarioRepository } from '../../../src/repositories/ScenarioRepository';
import { UnitRegistryRepository } from '../../../src/repositories/UnitRegistryRepository';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { runCommand, runHarness } from '../cli';

export async function expectFailedCapture(root: string): Promise<void> {
	const result = await runHarness(
		[
			'loop',
			'record',
			'repair',
			'--phase',
			'capture',
			'--test',
			'proof.ts',
			'--unit',
			'function.sample',
			'--command',
			'bun proof.ts && exit 2',
			'--json'
		],
		root,
		false
	);
	expect(result.exitCode).toBe(1);
	expect(result.stdout, 'partial captures survive a failed evidence command').toContain(
		'"captures"'
	);
	const record = JSON.parse(result.stdout);
	expect(record).toMatchObject({ phase: 'capture', status: 'failed', exitCode: 2 });
	expect(record.red).toBeUndefined();
	await runHarness(['history', 'build', '--out', 'partial-history', '--limit', '3'], root);
	const detail = JSON.parse(
		await readFile(join(root, 'partial-history/revisions', record.source.commit + '.json'), 'utf8')
	);
	expect(detail.regressions).toContainEqual(
		expect.objectContaining({
			red: null,
			green: expect.objectContaining({
				id: record.id,
				status: 'failed',
				captures: expect.any(Array)
			})
		})
	);
	const status = await runHarness(['history', 'status', '--json'], root);
	expect(JSON.parse(status.stdout).verified).toBe(false);
}

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
