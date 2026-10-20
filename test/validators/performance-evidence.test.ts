import { expect, test } from 'vitest';
import { PerformanceEvidenceValidator } from '../../src/validators/PerformanceEvidenceValidator';
import type { PerformanceEvidenceInput } from '../../src/validators/PerformanceEvidenceValidator';
import type { ComponentManifest } from '../../src/core/unitTypes';
import type { SourceFile } from '../../src/core/sourceTypes';
import { PerformanceProfileService } from '../../src/services/PerformanceProfileService';

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
	expect(validator.validate({ ...input, measurements: [] })[0]).toContain('profiling requires');
});

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

test('type-only models are inapplicable, while unreadable or unexported code stays required', async () => {
	const input = await observed();
	input.measurements = [];
	const file = input.files.get('title.ts')!;
	file.exports = [{ name: 'Title', kind: 'type', inputs: [] }];
	expect(new PerformanceEvidenceValidator().validate(input)).toEqual([]);
	file.read = false;
	expect(new PerformanceEvidenceValidator().validate(input)).toHaveLength(1);
	file.read = true;
	file.exports = [];
	expect(new PerformanceEvidenceValidator().validate(input)).toHaveLength(1);
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
