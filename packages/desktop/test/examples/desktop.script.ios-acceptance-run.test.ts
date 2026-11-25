import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { openDesign } from '../../scripts/ios-acceptance-run';
import { control } from '../../scripts/ios-acceptance-run';
import { FixtureControlOriginError } from '../../scripts/ios-acceptance-run.types';
import type { Acceptance } from '../../scripts/ios-acceptance-run.types';

function acceptance(
	page: object,
	project = { id: 'project-001', name: 'Fixture project' }
): Acceptance {
	return { page, project } as unknown as Acceptance;
}

test('opens the fixture project and waits for its design image', async () => {
	const calls: string[] = [];
	const page = {
		until: async (script: string, expected: string) => {
			calls.push(script);
			return expected;
		}
	};
	const run = acceptance(page);
	const output = await openDesign(run);

	expect(output).toBe('loaded');
	expect(calls).toHaveLength(4);
	expect(calls[3]).toContain('naturalWidth');
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-run',
			symbol: 'openDesign',
			state: 'opens-the-fixture-project-and-waits-for-its-design-image',
			evidence: 'examples-cases',
			file: 'opens-the-fixture-project-and-waits-for-its-design-image.json'
		},
		[
			{
				name: 'design image reaches loaded state',
				input: { projectName: 'Fixture project' },
				output
			}
		]
	);
});

test('refuses a fixture control origin outside this machine', async () => {
	const run = { controlOrigin: 'https://fixture.example' } as Acceptance;
	let thrown: unknown;
	try {
		await control(run, '/status');
	} catch (error) {
		thrown = error;
	}

	expect(thrown).toBeInstanceOf(FixtureControlOriginError);
	if (!(thrown instanceof Error)) throw new Error('Expected a fixture-origin error.');
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-run',
			symbol: 'control',
			state: 'refuses-a-fixture-control-origin-outside-this-machine',
			evidence: 'examples-cases',
			file: 'refuses-a-fixture-control-origin-outside-this-machine.json'
		},
		[
			{
				name: 'remote origin is rejected before requesting status',
				input: { origin: run.controlOrigin, path: '/status' },
				error: { name: thrown.name, message: thrown.message }
			}
		]
	);
});
