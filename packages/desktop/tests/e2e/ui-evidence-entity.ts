import type { HarnessUnit } from '../../../reports/src/models/Harness.types';
import type { Thumbnail } from '../../src/models/Desktop.types';
import type { UnitDocumentation } from '../../../../src/utils/unit-documentation/unitDocumentation';
import { commits, ids } from '../../../reports/test/entityUnits';

export const designSha = 'b'.repeat(64);
/** A commit of a planning branch: the shown branch does not list it, so nothing proves it. */
export const planningCommit = '9'.repeat(40);
const categories: Record<string, string> = {
	page: 'pages',
	component: 'components',
	function: 'functions',
	config: 'configs',
	service: 'services'
};
const happened = (id: string, kind: string, title: string, commit: string) => ({
	id,
	at: '2026-10-09T09:00:00.000Z',
	kind,
	title,
	detail: `Detail of ${title}`,
	commit,
	version: null
});
/** What happened to the filter: one change in the shown branch, one plan committed elsewhere. */
const filterHistory = [
	happened('changed', 'commit', 'feat: case-insensitive search', commits.middle),
	happened('planned', 'design', 'Plan of the filter committed', planningCommit)
];

/** What the viewer lists and opens for one unit; the page has one committed design as well. */
export function evidenceEntity(unit: HarnessUnit, image: number) {
	const designed = unit.id === ids.page;
	const design = {
		version: 'v001',
		createdAt: '2026-10-08',
		commit: commits.first,
		generator: 'GPT Image',
		prompt: 'Orders page',
		baseRevision: commits.first,
		images: [{ state: 'default', viewport: 'desktop', sha256: designSha, bytes: image }],
		approval: null
	};
	const thumbnail = { version: 'v001', sha256: designSha, state: 'default', viewport: 'desktop' };
	return {
		helperContracts: unit.helpers,
		documentation: undefined as UnitDocumentation | undefined,
		id: unit.id,
		category: categories[unit.kind],
		kind: unit.kind,
		title: unit.title,
		summary: unit.responsibility,
		changed: false,
		planned: false,
		hasPlan: false,
		lifecycle: null,
		verification: 'unverified',
		verificationNote: 'No verification recorded for this revision.',
		latestVersion: designed ? 'v001' : null,
		approvedVersion: null,
		threadCount: 0,
		thumbnail: (designed ? thumbnail : null) as Thumbnail | null,
		contract: { ...unit.contract, hash: null },
		relationships: [],
		versions: designed ? [design] : [],
		threads: [],
		history: unit.id === ids.filter ? filterHistory : [],
		sources: unit.owns.source,
		size: { available: false, text: 'Not measured' },
		performance: { available: false, text: 'Not measured' }
	};
}
