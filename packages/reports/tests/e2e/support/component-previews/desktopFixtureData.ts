import { commits } from '../../../../test/entityUnits';
import { desktopData as sealed } from './sealedData';
import { desktopFixtureCommits as identities } from './desktopFixtureCommits';

// Desktop examples use their own resealed artifacts; shared checked inputs stay intact.
const { desktopArtifacts, desktopScreens, ...shared } = sealed;
let serialized = JSON.stringify({
	...shared,
	results: { ...desktopArtifacts.results, ...desktopScreens.results },
	bindings: { ...desktopArtifacts.bindings, ...desktopScreens.bindings },
	bytes: {},
	design: []
});
for (const [original, replacement] of [
	[commits.first, identities.first],
	[commits.middle, identities.middle],
	[commits.tip, identities.tip],
	['9'.repeat(40), identities.plan]
])
	serialized = serialized.replaceAll(original, replacement);

export const desktopData = JSON.parse(serialized) as typeof shared;
desktopData.bytes = { ...sealed.bytes, ...desktopArtifacts.bytes, ...desktopScreens.bytes };
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

export const desktopArtifactText = desktopArtifacts.text;

export const desktopProject = { ...desktopData.project, root: '/Users/ada/projects/orders' };
