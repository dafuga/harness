import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { nativeScope } from '../../src/components/shared-primitives/native-approval/nativeScope';

test('Describes requested native project scope', async () => {
	const projects = {
		get: async (id: string) => {
			if (id === 'missing') throw new Error('unavailable');
			return { name: 'Oak Street' } as Awaited<
				ReturnType<Parameters<typeof nativeScope>[1]['get']>
			>;
		}
	};
	const inputs = [
		{ name: 'all projects', resource: 'projects' },
		{ name: 'named project', resource: 'project:oak' },
		{ name: 'unavailable project', resource: 'project:missing' },
		{ name: 'unspecified request', resource: null }
	];
	const outputs = await Promise.all(inputs.map(({ resource }) => nativeScope(resource, projects)));
	const cases = inputs.map((input, index) => ({
		name: input.name,
		input: { resource: input.resource },
		output: outputs[index]
	}));

	expect(outputs).toEqual([
		'every shared project you can open, now and later',
		'the project “Oak Street” only',
		'one project that this account cannot open',
		'every shared project you can open (the request does not say less)'
	]);
	recordExampleCases(
		{
			unitId: 'hub.function.native-scope',
			symbol: 'nativeScope',
			state: 'describes-requested-native-project-scope',
			evidence: 'examples-cases',
			file: 'describes-requested-native-project-scope.json'
		},
		cases
	);
});
