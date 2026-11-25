import { test } from 'vitest';
import { explorerBehavior } from '../../src/utils/explorer-ui/explorerBehavior';
import type { ExplorerSide } from '../../src/models/explorer-ui/Explorer.types';
import { capture, declared, record, result, sha } from '../explorerFixture';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { expect } from '../../../../test/verificationExpect';
import type { Shot, Behavior } from './reports.function.explorer-behavior.test.types';

export const clock = declared({
	id: 'clock',
	title: 'Clock',
	kind: 'headless',
	units: [],
	viewports: []
});
const unit = { unitId: 'reports.function.explorer-behavior', evidence: 'examples-cases' };

export const output = (hash: string, extra: Partial<Shot> = {}) =>
	capture({
		evidence: 'output',
		kind: 'output',
		state: 'default',
		viewport: undefined,
		sha256: hash.repeat(64),
		media: `media/${hash.repeat(64)}.json`,
		...extra
	});

/** One side; a result is usable when it passed and has media, as explorerEvidence sets it. */
export function side(
	commit: string,
	captures: Shot[],
	profile = 'p1',
	scenarios: Array<ReturnType<typeof result>> = []
): ExplorerSide {
	const items = captures.map((item) => {
		const usable = item.status === 'passed' && item.media !== null;
		return {
			scenario: 'clock',
			state: item.state,
			capture: item,
			standing: 'fresh' as const,
			usable,
			current: usable,
			inheritedFrom: null
		};
	});
	const source = { commit, base: null };
	return {
		commit,
		detail: null,
		record: record(scenarios, { id: `r-${commit[0]}`, profile, source }),
		captures: items,
		coverage: [],
		gap: null
	};
}

/** Behaviour of two sides; explorerEvidence names mixed profiles as the incomparable reason. */
export function compared(
	before: ExplorerSide | null,
	after: ExplorerSide,
	initial: string | null = null
) {
	const incomparable =
		before?.record && before.record.profile !== after.record?.profile
			? [
					`The two sides were recorded under different profiles (${before.record.profile} and ${after.record?.profile}).`
				]
			: [];
	return explorerBehavior({
		mode: 'commit',
		scenarios: [clock],
		incomparable,
		after,
		before,
		initial
	});
}

/** The observable parts of a behaviour result, without the media bytes. */
export const view = (shown: Behavior) => ({
	summary: shown.summary,
	reason: shown.reason,
	rows: shown.rows.map(({ state, kind, change }) => [state, kind, change]),
	scenarios: shown.scenarios
});
export const changes = (shown: Behavior) => shown.rows.map((row) => [row.state, row.change]);

/** Records one named symbol's cases, each a name with its observed input and result. */
export const trace = (symbol: string, state: string, list: Array<[string, unknown, unknown]>) =>
	recordExampleCases(
		{ ...unit, symbol, state, file: `${state}.json` },
		list.map(([name, input, output]) => ({ name, input, output }))
	);

test('equal recorded bytes on both sides are unchanged behaviour', () => {
	const shown = compared(side(sha('b'), [output('1')]), side(sha('a'), [output('1')]));
	expect(shown).toMatchObject({ mode: 'commit', summary: 'unchanged', reason: null });
	expect(changes(shown)).toEqual([['default', 'unchanged']]);
	trace('explorerBehavior', 'explorer-behavior-unchanged-bytes', [
		['equal bytes are unchanged', { before: '1', after: '1' }, view(shown)]
	]);
});
