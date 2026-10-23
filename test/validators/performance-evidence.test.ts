import { expect, test } from 'vitest';
import type { SourceFile } from '../../src/core/development-tooling/sourceTypes';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';
import { PerformanceProfileService } from '../../src/services/verification-evidence/PerformanceProfileService';
import type { PerformanceEvidenceInput } from '../../src/validators/verification-evidence/PerformanceEvidenceValidator';
import { PerformanceEvidenceValidator } from '../../src/validators/verification-evidence/PerformanceEvidenceValidator';
import { indexFiles } from '../support/memoryTree';
import { profileEvidenceValidation } from '../support/taskProfiles';

async function observed(): Promise<PerformanceEvidenceInput> {
	const commit = 'a'.repeat(40);
	const measurements = await new PerformanceProfileService().measure(
		{ unit: 'function.title', workload: 'title', iterations: 2, rounds: 1, warmups: 0 },
		() => 'TITLE'.toLowerCase()
	);
	return {
		commit,
		profile: 'test-runtime',
		units: [
			{
				id: 'function.title',
				status: 'active',
				owns: { source: ['title.ts'] },
				runtime: { kind: 'module', targets: [{ kind: 'module' }] },
				budgets: { performance: [] }
			} as unknown as ComponentManifest
		],
		files: new Map([
			[
				'title.ts',
				{ read: true, exports: [{ name: 'formatTitle', kind: 'function' }] } as SourceFile
			]
		]),
		measurements: measurements.map((item) => ({
			...item,
			profile: 'test-runtime',
			testedRevision: commit,
			artifacts: []
		}))
	};
}

test('actual observations are required even when a unit declares no performance budget', async () => {
	const input = await observed();
	const validator = new PerformanceEvidenceValidator();
	expect(validator.validate(input)).toEqual([]);
	await profileEvidenceValidation(input);
	expect(validator.validate({ ...input, measurements: [] })[0]).toContain('profiling requires');
});

test.each(['module', 'http'] as const)(
	'browser observations match only their declared %s target',
	async (target) => {
		const input = await observed();
		input.units[0].runtime.targets[0].kind = target;
		input.measurements = input.measurements.map((item) => ({
			...item,
			target,
			metric: item.unitOfMeasure === 'ms' ? 'browser-navigation-ms' : 'browser-js-heap-bytes'
		}));
		const validator = new PerformanceEvidenceValidator();
		expect(
			validator.validate(input),
			'browser navigation and heap satisfy the declared target'
		).toEqual([]);
		input.measurements[1].target = target === 'module' ? 'http' : 'module';
		expect(
			validator.validate(input),
			'a different target cannot lend its browser heap'
		).toHaveLength(1);
	}
);

test.each(['revision', 'profile', 'target', 'workload', 'samples', 'unavailable'])(
	'%s mismatches cannot satisfy required profiling',
	async (change) => {
		const input = await observed();
		input.measurements = input.measurements.map((item) => ({
			...item,
			...(change === 'revision' ? { testedRevision: 'b'.repeat(40) } : {}),
			...(change === 'profile' ? { profile: 'another-runtime' } : {}),
			...(change === 'target' ? { target: 'process' as const } : {}),
			...(change === 'samples' ? { samples: undefined } : {}),
			...(change === 'unavailable' ? { value: null, unavailable: 'not measured' } : {}),
			...(change === 'workload' && item.metric.includes('rss') ? { workload: 'other' } : {})
		}));
		expect(new PerformanceEvidenceValidator().validate(input)).not.toEqual([]);
	}
);

test('one callable cannot lend its observations to another helper in the same module', async () => {
	const input = await observed();
	input.units[0].helperContracts = [
		{ name: 'formatTitle' },
		{ name: 'formatSubtitle' }
	] as ComponentManifest['helperContracts'];
	input.measurements = input.measurements.map((item) => ({ ...item, callable: 'formatTitle' }));
	const missing = new PerformanceEvidenceValidator().validate(input);
	expect(missing).toHaveLength(1);
	expect(missing[0]).toContain('#formatSubtitle');
});

const declarationCases = [
	['type declarations', 'export interface Title { text: string }', false],
	['type imports', 'import type { Value } from "./value";\nexport type Title = Value;', false],
	[
		'ambient globals',
		'declare global { namespace App { interface Platform { id: string } } }\nexport {};',
		false
	],
	['empty module marker', 'export {};', false],
	[
		'module initialization',
		'console.log("initialize");\nexport interface Title { text: string }',
		true
	],
	['side-effect import', 'import "./initialize";\nexport interface Title { text: string }', true],
	[
		'value import',
		'import { initialize } from "./initialize";\nexport interface Title { text: string }',
		true
	],
	[
		'private operation',
		'function initialize() { return 1; }\nexport interface Title { text: string }',
		true
	],
	['runtime enum', 'export enum State { Ready, Finished }', true],
	['unparseable declaration', 'export interface Title {', true]
] as const;

test.each(declarationCases)(
	'parsed %s determines runtime applicability',
	async (_name, code, required) => {
		const path = 'src/models/Title.types.ts';
		const indexed = await indexFiles({ [path]: code });
		const input = await observed();
		input.units[0].owns.source = [path];
		input.files = indexed.index.files;
		const validator = new PerformanceEvidenceValidator();
		expect(
			validator.required(input.units, input.files),
			'parsed source determines profiling'
		).toHaveLength(required ? 1 : 0);
		input.files.get(path)!.read = false;
		expect(
			validator.required(input.units, input.files),
			'unreadable source remains required'
		).toHaveLength(1);
	}
);

test('readable stylesheets are declarative while unreadable and mixed sources stay required', async () => {
	const input = await observed();
	input.measurements = [];
	const unit = input.units[0];
	const file = input.files.get('title.ts')!;
	input.files = new Map([['title.css', { ...file, language: 'css', exports: [] }]]);
	unit.owns.source = ['title.css'];
	const validator = new PerformanceEvidenceValidator();
	expect(validator.required(input.units, input.files)).toEqual([]);
	input.files.get('title.css')!.read = false;
	expect(validator.required(input.units, input.files)).toEqual([unit]);
	input.files.get('title.css')!.read = true;
	input.files.set('title.ts', file);
	unit.owns.source.push('title.ts');
	expect(validator.required(input.units, input.files)).toEqual([unit]);
});

test('synthetic rule-fixture values cannot establish runtime profiling', async () => {
	const input = await observed();
	input.measurements = input.measurements.map((item) => ({
		...item,
		comparison: {
			request: 'a'.repeat(64),
			boundary: 'fixture',
			protocol: 'declared-constant/1',
			sampling: { warmup: 0, rounds: 1, iterations: 1 }
		}
	}));
	expect(new PerformanceEvidenceValidator().validate(input)).not.toEqual([]);
});
