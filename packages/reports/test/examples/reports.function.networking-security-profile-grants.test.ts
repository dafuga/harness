import { test } from 'vitest';
import type { ProfileEntry } from '../../src/components/networking-security/ExplorerPermissionsScreen.types';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { profileGrants } from '../../src/components/networking-security/explorer-permissions-screen/profileGrants';

const releaseAuditor: ProfileEntry = {
	schemaVersion: 1,
	id: 'release-auditor',
	title: 'Release auditor',
	description: 'Reads release evidence and the API that publishes it.',
	grants: [
		{
			kind: 'api',
			resource: 'reports.endpoint.evidence-records',
			actions: ['GET'],
			data: [
				{
					resource: 'evidence-records',
					actions: ['read'],
					fields: ['id', 'status', 'commit'],
					scope: 'own'
				}
			]
		},
		{ kind: 'page', resource: 'reports.component.evidence-grid', actions: ['view'] },
		{
			kind: 'data',
			resource: 'release-notes',
			actions: ['read'],
			fields: ['id', 'title'],
			scope: 'all'
		}
	],
	source: 'specification/permissions/release-auditor.json'
};

const viewer: ProfileEntry = {
	schemaVersion: 1,
	id: 'viewer',
	title: 'Viewer',
	description: 'Views the evidence grid only.',
	grants: [{ kind: 'page', resource: 'reports.component.evidence-grid', actions: ['view'] }],
	source: 'specification/permissions/viewer.json'
};

const noAccess: ProfileEntry = {
	schemaVersion: 1,
	id: 'no-access',
	title: 'No access',
	description: 'Declares no grants.',
	grants: [],
	source: 'specification/permissions/no-access.json'
};

function summarise(grants: ProfileEntry['grants']) {
	return grants.map((grant) => ({ kind: grant.kind, resource: grant.resource }));
}

function metaFor(state: string) {
	return {
		unitId: 'reports.function.networking-security-profile-grants',
		symbol: 'profileGrants',
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

test('Keeps only the grants of the requested kind', () => {
	const apiGrants = profileGrants(releaseAuditor, 'api');
	const dataGrants = profileGrants(releaseAuditor, 'data');

	expect(summarise(apiGrants)).toEqual([
		{ kind: 'api', resource: 'reports.endpoint.evidence-records' }
	]);
	expect(apiGrants[0]).toBe(releaseAuditor.grants[0]);
	expect(summarise(dataGrants)).toEqual([{ kind: 'data', resource: 'release-notes' }]);
	expect(apiGrants).not.toBe(releaseAuditor.grants);

	recordExampleCases(metaFor('keeps-only-the-grants-of-the-requested-kind'), [
		{
			name: 'api kind keeps the endpoint grant',
			input: { profile: 'release-auditor', kind: 'api' },
			output: summarise(apiGrants)
		},
		{
			name: 'data kind keeps the data grant',
			input: { profile: 'release-auditor', kind: 'data' },
			output: summarise(dataGrants)
		}
	]);
});

test('Returns an empty array when no grant has the requested kind', () => {
	const viewerData = profileGrants(viewer, 'data');
	const noAccessApi = profileGrants(noAccess, 'api');

	expect(viewerData).toEqual([]);
	expect(noAccessApi).toEqual([]);
	expect(viewerData).not.toBe(viewer.grants);

	recordExampleCases(metaFor('returns-an-empty-array-when-no-grant-has-the-requested-kind'), [
		{
			name: 'viewer profile asked for data grants',
			input: { profile: 'viewer', kind: 'data' },
			output: []
		},
		{
			name: 'profile with no grants asked for api grants',
			input: { profile: 'no-access', kind: 'api' },
			output: []
		}
	]);
});

test('Throws a TypeError when the profile declares no grants list', () => {
	const broken = { ...viewer, grants: null } as unknown as ProfileEntry;

	expect(() => profileGrants(broken, 'api')).toThrow(TypeError);

	recordExampleCases(metaFor('throws-a-typeerror-when-the-profile-declares-no-grants-list'), [
		{
			name: 'grants is null on the profile',
			input: { profile: 'viewer with grants null', kind: 'api' },
			error: 'TypeError'
		}
	]);
});
