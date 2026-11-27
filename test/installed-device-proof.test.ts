import { expect, test } from 'vitest';
import { installedDeviceProofBlockers } from '../scripts/check-installed-device-proof';

const release = 'fixture-release@approved-sha';
const surfaces = ['mac', 'iphone'];
const trackedAction = {
	firstAction: 'Tap Canary C on the labeled Needs you item',
	authoritativeSource: 'Tracker',
	expectedResult: 'Canary C recorded from the expected app actor on the matching canary item',
	owner: 'Fixture release verifier'
};
const iphone = {
	...trackedAction,
	entryState: 'Signed out and unlinked in the installed app',
	expectedBuild: 'fixture-ios-2',
	approvalHost: 'daniel-primary-mbp',
	proof: {
		status: 'passed',
		device: 'Fixture physical iPhone',
		target: 'physical-device',
		installedBuild: 'fixture-ios-2',
		signature: 'verified',
		setup: 'supported-from-entry-state',
		googleReturn: 'real',
		approvedOn: 'daniel-primary-mbp',
		action: { via: 'installed-app', evidence: 'Observed tap on fixture item F-007' },
		readback: {
			source: 'Tracker',
			result: trackedAction.expectedResult,
			evidence: 'F-007 persisted the expected option and iPhone actor'
		},
		cleanup: 'Fixture canary F-007 cleaned up'
	}
};
const mac = {
	...iphone,
	expectedBuild: 'fixture-mac-3',
	approvalHost: null,
	proof: {
		...iphone.proof,
		device: 'Fixture physical Mac',
		installedBuild: 'fixture-mac-3',
		approvedOn: null
	}
};

function evaluate(phone: unknown) {
	return installedDeviceProofBlockers(
		{ schemaVersion: 1, releaseBoundary: release, surfaces: { mac, iphone: phone } },
		release,
		surfaces
	);
}

test('an installed Mac, a simulator callback and TestFlight availability leave iPhone pending', () => {
	const historical = {
		...iphone,
		proof: {
			status: 'blocked',
			missingHop: 'Real Google return on a signed installed physical iPhone was not seen',
			observations: 'Synthetic callback passed on iOS Simulator. TestFlight build was available.'
		}
	};
	expect(evaluate(historical)).toEqual([
		'iphone: Real Google return on a signed installed physical iPhone was not seen'
	]);
	expect(
		evaluate({
			...iphone,
			proof: { ...iphone.proof, target: 'simulator', googleReturn: 'synthetic' }
		})
	).toEqual([
		expect.stringContaining('iphone: proof.target'),
		expect.stringContaining('iphone: proof.googleReturn')
	]);
	expect(
		installedDeviceProofBlockers(
			{ schemaVersion: 1, releaseBoundary: release, surfaces: { mac } },
			release,
			surfaces
		)
	).toEqual(['iphone: missing surface proof']);
});

test('a complete record passes only at its reviewed release boundary and host, build and readback', () => {
	expect(evaluate(iphone)).toEqual([]);
	expect(
		installedDeviceProofBlockers(
			{ schemaVersion: 1, releaseBoundary: release, surfaces: { mac, iphone } },
			'another-release',
			surfaces
		)
	).toEqual(['Record is for a different release boundary']);
	expect(
		evaluate({
			...iphone,
			proof: {
				...iphone.proof,
				installedBuild: 'other-build',
				approvedOn: 'another-host',
				readback: { ...iphone.proof.readback, source: 'local cache', result: 'nothing seen' }
			}
		})
	).toEqual([
		expect.stringContaining('iphone: proof.installedBuild'),
		expect.stringContaining('iphone: proof.approvedOn'),
		expect.stringContaining('iphone: proof.readback.source'),
		expect.stringContaining('iphone: proof.readback.result')
	]);
	expect(
		evaluate({
			...iphone,
			proof: {
				...iphone.proof,
				setup: 'prelinked',
				action: { via: 'api', evidence: 'direct answer' }
			}
		})
	).toEqual([
		expect.stringContaining('iphone: proof.setup'),
		expect.stringContaining('iphone: proof.action.via')
	]);
});
