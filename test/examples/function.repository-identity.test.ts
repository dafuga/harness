import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import {
	repositoryIdentity,
	sameRepository,
	sameSite
} from '../../src/utils/accounts-access/repository-identity/repositoryIdentity';

test('Repository and plain-site membership follow their identities', async () => {
	const cases = await withTempRepo(async ({ root }) => {
		const identity = repositoryIdentity(root);
		const repositoryMatch = sameRepository(root, root);
		const repositorySiteMatch = sameSite(root, root);
		const plainSiteResult = await withTempDir('repository-identity-site-', async (site) => ({
			exact: sameSite(site, site),
			subdirectory: sameSite(site, `${site}/child`)
		}));

		expect(identity).toMatch(/^[a-f0-9]{64}$/);
		expect(repositoryMatch).toBe(true);
		expect(repositorySiteMatch).toBe(true);
		expect(plainSiteResult).toEqual({ exact: true, subdirectory: false });
		return [
			{
				name: 'checkout without a remote uses its canonical Git store',
				input: { directory: '/srv/checkouts/billing-web' },
				output: { identity, sameRepository: repositoryMatch, sameSite: repositorySiteMatch }
			},
			{
				name: 'plain site owns only its exact directory',
				input: { site: '/srv/sites/status-page', directory: '/srv/sites/status-page' },
				output: plainSiteResult
			}
		];
	});

	recordExampleCases(
		{
			unitId: 'function.repository-identity',
			symbol: 'repositoryIdentity',
			state: 'repository-and-plain-site-membership-follow-their-identities',
			evidence: 'examples-cases',
			file: 'repository-and-plain-site-membership-follow-their-identities.json'
		},
		cases
	);
});

test('Throws TypeError when a file remote has a host', async () => {
	await withTempRepo(async ({ root, git }) => {
		git('config', 'remote.origin.url', 'file://server/repository');
		expect(() => repositoryIdentity(root)).toThrow(TypeError);
		recordExampleCases(
			{
				unitId: 'function.repository-identity',
				symbol: 'repositoryIdentity',
				state: 'throws-typeerror-when-a-file-remote-has-a-host',
				evidence: 'examples-cases',
				file: 'throws-typeerror-when-a-file-remote-has-a-host.json'
			},
			[
				{
					name: 'file remote with host',
					input: { remote: 'file://server/repository' },
					error: 'TypeError'
				}
			]
		);
	}, 'repository-identity-error-');
});

test('Throws URIError when a file remote has malformed encoding', async () => {
	await withTempRepo(async ({ root, git }) => {
		git('config', 'remote.origin.url', 'file:///tmp/repository%zz');
		expect(() => repositoryIdentity(root)).toThrow(URIError);
		recordExampleCases(
			{
				unitId: 'function.repository-identity',
				symbol: 'repositoryIdentity',
				state: 'throws-urierror-when-a-file-remote-has-malformed-encoding',
				evidence: 'examples-cases',
				file: 'throws-urierror-when-a-file-remote-has-malformed-encoding.json'
			},
			[
				{
					name: 'malformed file URL escape',
					input: { remote: 'file:///tmp/repository%zz' },
					error: 'URIError'
				}
			]
		);
	}, 'repository-identity-error-');
});
