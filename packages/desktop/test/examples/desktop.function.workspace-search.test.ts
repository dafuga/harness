import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { workspaceSearch } from '../../src/components/projects-sessions/nav-bar/workspaceSearch';
import { explorerName } from '../../../reports/src/utils/explorer-ui/explorerName';
import type {
	CatalogEntity,
	ProjectSnapshot
} from '../../src/models/development-tooling/Desktop.types';

const unitId = 'desktop.function.workspace-search';
const [tip, earlier] = ['a'.repeat(40), 'c'.repeat(40)];
const alpha = '/projects/local-alpha/harness/branch/feat%2Falpha';

function entity(id: string, category: string, title: string): CatalogEntity {
	return {
		...{ id, category, kind: category, title, summary: `${title} summary` },
		...{ changed: false, planned: false, hasPlan: false, lifecycle: null },
		...{ verification: 'unverified', verificationNote: '', latestVersion: null },
		...{ approvedVersion: null, threadCount: 0, thumbnail: null }
	} as CatalogEntity;
}

const frame = entity('app.shell.order-frame', 'layouts', 'Order frame');
const fn = entity(unitId, 'functions', 'workspaceSearch');

function snapshot(
	commit: string,
	entities: CatalogEntity[] = [frame, fn],
	id = 'local-alpha'
): ProjectSnapshot {
	return {
		project: { name: 'Alpha', root: '/alpha', id },
		revision: { branch: 'feat/alpha', commit, tip, atTip: commit === tip },
		...{ branches: [], commits: [], entities, writable: commit === tip }
	} as ProjectSnapshot;
}

function read(commit: string, pinned = false, entities?: CatalogEntity[], id?: string) {
	return workspaceSearch({ snapshot: snapshot(commit, entities, id), pinned, busy: false });
}

/** The trace names the shown project and revision by value, not by the whole snapshot. */
function shownSummary(commit: string, pinned: boolean, busy = false) {
	return { project: 'Alpha', commit, atTip: commit === tip, pinned, busy, entities: 2 };
}

test('Lists every entity of the shown tip at its full commit with no search terms', () => {
	const search = read(tip);
	expect(search.entries).toEqual(
		[frame, fn].map((item) => ({
			id: item.id,
			category: item.category,
			name: explorerName(item),
			purpose: item.summary,
			terms: [],
			commit: tip
		}))
	);
	expect(search.scope).toEqual({ label: 'Alpha at the tip of feat/alpha', pinned: null });
	expect(search.at(search.entries![0])).toBe(`${alpha}/layouts/app.shell.order-frame`);

	recordExampleCases(
		{
			unitId,
			symbol: 'workspaceSearch',
			state: 'lists-every-entity-of-the-shown-tip',
			evidence: 'examples-cases',
			file: 'lists-every-entity-of-the-shown-tip.json'
		},
		[
			{
				name: 'tip revision, not pinned, two entities',
				input: { shown: shownSummary(tip, false) },
				output: {
					entries: search.entries,
					scope: search.scope,
					first: search.at(search.entries![0])
				}
			}
		]
	);
});

test('A pinned or off-tip revision names seven characters and keeps the full commit in addresses', () => {
	const pinned = read(earlier, true);
	const offTip = read(earlier);
	const frameAddress = `${alpha}/commit/${earlier}/layouts/app.shell.order-frame`;
	const fnAddress = `${alpha}/commit/${earlier}/functions/${unitId}`;
	expect(pinned.scope).toEqual({ label: 'Alpha at commit ccccccc', pinned: 'ccccccc' });
	expect(offTip.scope).toEqual(pinned.scope);
	expect(pinned.entries?.map((item) => item.commit)).toEqual([earlier, earlier]);
	expect(pinned.at(pinned.entries![0])).toBe(frameAddress);
	expect(offTip.at(offTip.entries![1])).toBe(fnAddress);

	recordExampleCases(
		{
			unitId,
			symbol: 'workspaceSearch',
			state: 'pinned-or-off-tip-keeps-the-commit',
			evidence: 'examples-cases',
			file: 'pinned-or-off-tip-keeps-the-commit.json'
		},
		[
			{
				name: 'pinned earlier commit',
				input: { shown: shownSummary(earlier, true) },
				output: {
					scope: pinned.scope,
					commits: pinned.entries?.map((item) => item.commit),
					first: pinned.at(pinned.entries![0])
				}
			},
			{
				name: 'earlier commit not pinned and not at tip',
				input: { shown: shownSummary(earlier, false) },
				output: {
					scope: offTip.scope,
					second: offTip.at(offTip.entries![1])
				}
			}
		]
	);
});

test('Gives no entries and the reading label while busy or without a snapshot', () => {
	const listed = read(tip).entries![0];
	const shown = [
		{
			input: shownSummary(tip, false, true),
			value: { snapshot: snapshot(tip), pinned: false, busy: true }
		},
		{
			input: shownSummary(earlier, true, true),
			value: { snapshot: snapshot(earlier), pinned: true, busy: true }
		},
		{
			input: { snapshot: null, pinned: false, busy: false },
			value: { snapshot: null, pinned: false, busy: false }
		}
	];
	const cases = shown.map(({ input, value }) => {
		const search = workspaceSearch(value);
		expect([search.entries, search.scope]).toEqual([
			null,
			{ label: 'Reading the project', pinned: null }
		]);
		expect(search.at(listed)).toBeNull();
		return {
			name: `shown with busy ${value.busy} and snapshot ${value.snapshot !== null}`,
			input,
			output: { entries: search.entries, scope: search.scope, at: search.at(listed) }
		};
	});

	recordExampleCases(
		{
			unitId,
			symbol: 'workspaceSearch',
			state: 'reads-nothing-while-busy-or-unread',
			evidence: 'examples-cases',
			file: 'reads-nothing-while-busy-or-unread.json'
		},
		cases
	);
});

test('Resolves only listed results of a supported category, never copies or other revisions', () => {
	const current = read(tip);
	const [listed] = current.entries!;
	const copy = { ...listed };
	const otherRevision = read(earlier, true);
	const otherProject = read(tip, false, undefined, 'local-beta');
	const unsupported = read(tip, false, [entity('x.y.z', 'platforms', 'Bogus')]);
	const outcomes = {
		listed: current.at(listed),
		copy: current.at(copy),
		otherRevision: current.at(otherRevision.entries![0]),
		otherProject: current.at(otherProject.entries![0]),
		unsupported: unsupported.at(unsupported.entries![0])
	};
	expect(outcomes).toEqual({
		listed: `${alpha}/layouts/app.shell.order-frame`,
		copy: null,
		otherRevision: null,
		otherProject: null,
		unsupported: null
	});

	recordExampleCases(
		{
			unitId,
			symbol: 'workspaceSearch',
			state: 'resolves-only-listed-supported-results',
			evidence: 'examples-cases',
			file: 'resolves-only-listed-supported-results.json'
		},
		[
			{
				name: 'listed result of the tip, and four results at no listed address',
				input: {
					listed: 'entries of the shown tip',
					copy: 'a spread copy of a listed entry',
					otherRevision: 'entry of a pinned earlier commit',
					otherProject: 'entry of another project',
					unsupported: 'entry whose category is not supported'
				},
				output: outcomes
			}
		]
	);
});
