import { ScenarioRepository } from '../../../src/repositories/ScenarioRepository';
import { UnitRegistryRepository } from '../../../src/repositories/UnitRegistryRepository';

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
