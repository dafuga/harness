import { afterEach, expect, test } from 'vitest';
import { unitsConfigSchema } from '../../src/core/unitsConfig';
import { defaultVerifyConfig } from '../../src/core/verifyTypes';
import { resourceRequestSchema } from '../../src/core/execution-runtimes/resourceTypes';
import { scenarioManifestSchema } from '../../src/core/development-tooling/unitTypes';
import { verifyPlan } from '../../src/workflows/verification-evidence/run-verify/verification-service/verifyPlan';
import { resourceQueueFixture } from '../support/resourceFixture';

const cleanup: Array<() => void> = [];
afterEach(() => {
	cleanup.splice(0).forEach((dispose) => dispose());
});

const unitsConfig = unitsConfigSchema.parse({
	schemaVersion: 1,
	workspaces: [{ name: '', root: '.' }],
	tests: ['test/'],
	global: [],
	ignored: [],
	references: []
});

test('a scenario check carries its declared memory reservation and others keep the default', () => {
	const scenario = scenarioManifestSchema.parse({
		schemaVersion: 1,
		id: 'workers',
		title: 'Workers',
		kind: 'headless',
		units: ['service.workers'],
		states: [{ id: 'default', title: 'Default', coverage: 'required' }],
		viewports: [],
		evidence: [],
		tests: [
			{
				id: 'nested',
				kind: 'e2e',
				runner: 'vitest',
				target: 'test/a.e2e.test.ts',
				memoryMiB: 2560
			},
			{ id: 'plain', kind: 'unit', runner: 'vitest', target: 'test/b.test.ts' }
		]
	});
	const checks = verifyPlan({
		selectedTests: [],
		scenarios: [scenario],
		config: defaultVerifyConfig,
		unitsConfig
	});
	expect(checks.map(({ name, memoryMiB }) => ({ name, memoryMiB }))).toEqual([
		{ name: 'nested', memoryMiB: 2560 },
		{ name: 'plain', memoryMiB: undefined }
	]);
	expect(() =>
		scenarioManifestSchema.parse({ ...scenario, tests: [{ ...scenario.tests[0], memoryMiB: 0 }] })
	).toThrow();
});

test('a check sized for its nested task CLI admits the 2048 MiB run the default lease refuses', async () => {
	const { service } = resourceQueueFixture(cleanup);
	const nested = (env: Record<string, string>) =>
		service.run(resourceRequestSchema.parse({ cpus: 1, memoryMiB: 2048 }), async () => 'ran', {
			env
		});
	await expect(
		service.run(resourceRequestSchema.parse({ cpus: 1 }), (context) => nested(context.env))
	).rejects.toThrow('Nested work exceeds its parent resource reservation');
	await expect(
		service.run(resourceRequestSchema.parse({ cpus: 1, memoryMiB: 2560 }), (context) =>
			nested(context.env)
		)
	).resolves.toBe('ran');
});
