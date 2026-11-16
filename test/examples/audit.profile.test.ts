import { test } from 'vitest';
import { parseAuditProfile } from '../../src/audit/development-tooling/profile';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

function rejectedProfile(profile: string): { name: string; message: string } {
	let error: unknown;
	try {
		parseAuditProfile(profile);
	} catch (caught) {
		error = caught;
	}
	expect(error).toBeInstanceOf(Error);
	const actual = error as Error & { name: string };
	expect(actual.name).toBe('ExpectedCliError');
	expect(actual.message).toBe(
		`Unsupported audit profile "${profile}". Use one of: auto, app, dapp, lib.`
	);
	return { name: actual.name, message: actual.message };
}

test('Accepts the documented profiles and rejects a case variant', () => {
	const acceptedProfiles = ['auto', 'app', 'dapp'] as const;
	const acceptedCases = acceptedProfiles.map((profile) => {
		const output = parseAuditProfile(profile);
		expect(output).toBe(profile);
		return { name: `accepts ${profile}`, input: profile, output };
	});
	const rejectedProfiles = ['APP'];
	const rejectedCases = rejectedProfiles.map((profile) => ({
		name: `rejects ${JSON.stringify(profile)}`,
		input: profile,
		error: rejectedProfile(profile)
	}));

	recordExampleCases(
		{
			unitId: 'audit.profile',
			symbol: 'parseAuditProfile',
			state: 'accepts-the-documented-profiles-and-rejects-a-case-variant',
			evidence: 'examples-cases',
			file: 'accepts-the-documented-profiles-and-rejects-a-case-variant.json'
		},
		[...acceptedCases, ...rejectedCases]
	);
});
