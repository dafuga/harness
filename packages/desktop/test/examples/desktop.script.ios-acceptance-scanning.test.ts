import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { scanEndings, cameraOnly } from '../../scripts/ios-acceptance-scanning';

function runWithUntrustedControl() {
	return {
		record: {
			begin: (_title: string) => undefined,
			hide: (_value: string) => undefined,
			check: (_passed: boolean, _message: string) => undefined
		},
		page: {},
		udid: 'made-up-simulator',
		controlOrigin: 'https://fixture.example.invalid',
		project: { id: 'example-project', name: 'Example' },
		output: '/tmp/ios-acceptance-example'
	} as Parameters<typeof scanEndings>[0];
}

function errorCase(error: unknown) {
	if (!(error instanceof Error)) throw new Error('Expected an error.');
	return { name: error.name, message: error.message };
}

test('refuses scan endings when fixture control is not local', async () => {
	const run = runWithUntrustedControl();
	let thrown: unknown;
	try {
		await scanEndings(run);
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(Error);
	expect(thrown).toMatchObject({ message: 'The control of the fixture is not on this machine.' });
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-scanning',
			symbol: 'scanEndings',
			state: 'refuses-scan-endings-when-fixture-control-is-not-local',
			evidence: 'examples-cases',
			file: 'refuses-scan-endings-when-fixture-control-is-not-local.json'
		},
		[
			{
				name: 'reject a control origin outside loopback',
				input: { controlOrigin: run.controlOrigin },
				error: errorCase(thrown)
			}
		]
	);
});

test('refuses camera checks when fixture control is not local', async () => {
	const run = runWithUntrustedControl();
	const product = 'Debug';
	let thrown: unknown;
	try {
		await cameraOnly(run, product);
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(Error);
	expect(thrown).toMatchObject({ message: 'The control of the fixture is not on this machine.' });
	recordExampleCases(
		{
			unitId: 'desktop.script.ios-acceptance-scanning',
			symbol: 'cameraOnly',
			state: 'refuses-camera-checks-when-fixture-control-is-not-local',
			evidence: 'examples-cases',
			file: 'refuses-camera-checks-when-fixture-control-is-not-local.json'
		},
		[
			{
				name: 'reject a camera check with an untrusted fixture origin',
				input: { controlOrigin: run.controlOrigin, product },
				error: errorCase(thrown)
			}
		]
	);
});
