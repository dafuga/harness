import { commits } from '../../../../test/entityUnits';
import { desktopData as sealed } from './sealedData';
import { desktopFixtureCommits as identities } from './desktopFixtureCommits';

// Remap only the Desktop DTOs and their binding keys; original checked bytes stay intact.
let serialized = JSON.stringify({ ...sealed, bytes: {}, design: [] });
for (const [original, replacement] of [
	[commits.first, identities.first],
	[commits.middle, identities.middle],
	[commits.tip, identities.tip],
	['9'.repeat(40), identities.plan]
])
	serialized = serialized.replaceAll(original, replacement);

export const desktopData = JSON.parse(serialized) as typeof sealed;
desktopData.bytes = sealed.bytes;
desktopData.design = sealed.design;
desktopData.commits = [
	{
		hash: identities.tip,
		subject: 'Refine orders list presentation',
		authoredAt: '2026-10-12T16:20:00Z'
	},
	{
		hash: identities.middle,
		subject: 'Add case-insensitive order search',
		authoredAt: '2026-10-10T10:24:00Z'
	},
	{
		hash: identities.first,
		subject: 'Define order-search API',
		authoredAt: '2026-10-08T08:45:00Z'
	}
];
