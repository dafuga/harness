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
