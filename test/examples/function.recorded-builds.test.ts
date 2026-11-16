import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { recordedBuilds } from '../../src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/recordedBuilds';
import type { RecordedBuild } from '../../src/workflows/verification-evidence/run-verify/verification-service/record-assembly-service/recordedBuilds.types';

const webBuild = {
	id: 'web-client',
	directory: 'dist/web',
	buildId: '9c1e4f0a7b2d86e35f1a0c9d4b7e2f83a6d15c0e9f4b2a7d38c6e1f05a9b4d72',
	files: 48,
	stamp: '2026-11-16T10:00:00Z'
} satisfies RecordedBuild & { stamp: string };

const apiBuild = {
	id: 'api-server',
	directory: 'build/api',
	buildId: 'e27a09c4d8f13b6e5a92c7d0f48e1b3a6c95d2e0f7a4b18c3d6e9f25a07b4c1d',
	files: 7
} satisfies RecordedBuild;

test('Recorded builds retain identity fields and copy skipped ids', () => {
	const empty = recordedBuilds();
	const observed = recordedBuilds([webBuild, apiBuild], ['docs.site']);
	const explicitEmpty = recordedBuilds([], []);

	expect(empty).toEqual({});
	expect(observed).toEqual({
		builds: [
			{
				id: webBuild.id,
				directory: webBuild.directory,
				buildId: webBuild.buildId,
				files: webBuild.files
			},
			apiBuild
		],
		skippedBuilds: ['docs.site']
	});
	expect(explicitEmpty).toEqual({ builds: [], skippedBuilds: [] });
	recordExampleCases(
		{
			unitId: 'function.recorded-builds',
			symbol: 'recordedBuilds',
			state: 'recorded-builds-retain-identity-fields-and-copy-skipped-ids',
			evidence: 'examples-cases',
			file: 'recorded-builds-retain-identity-fields-and-copy-skipped-ids.json'
		},
		[
			{ name: 'no builds or skipped ids were supplied', input: {}, output: empty },
			{
				name: 'observed builds retain identity fields and skipped ids are recorded',
				input: { observed: [webBuild, apiBuild], skipped: ['docs.site'] },
				output: observed
			},
			{
				name: 'explicit empty observations and skipped ids stay present',
				input: { observed: [], skipped: [] },
				output: explicitEmpty
			}
		]
	);
});
