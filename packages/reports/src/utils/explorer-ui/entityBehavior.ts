import type {
	BehaviorCell,
	BehaviorOutcome,
	BehaviorLine,
	BehaviorGroup,
	EntityBehavior
} from './entityBehavior.types';
import type {
	ExplorerArtifact,
	ExplorerBehavior,
	ExplorerBehaviorRow
} from '../../models/explorer-ui/Explorer.types';
import type { HarnessCapture, HarnessRecord } from '../../models/explorer-ui/Harness.types';

// Different bytes are not yet a different behaviour: only what the results hold says that.
const labels: Record<ExplorerBehavior['summary'], string> = {
	unchanged: 'Behavior unchanged',
	changed: 'Behavior changed',
	added: 'Behavior changed',
	removed: 'Behavior changed',
	differs: 'Recorded results differ',
	unknown: 'Behavior unknown',
	'not-compared': 'First version'
};
// What the host says in its own reason, such as bytes that differ unread, is not said twice.
const told: Partial<Record<ExplorerBehaviorRow['change'], string>> = {
	changed: 'changed',
	added: 'is new',
	removed: 'is gone'
};

const cell = (capture: HarnessCapture | null, read?: ExplorerArtifact | null): BehaviorCell => ({
	outcome: capture ? capture.status : 'missing',
	capture,
	...(read === undefined ? {} : { read })
});

/** A state passed when it recorded something and all of it passed; nothing recorded is missing. */
function outcome(cells: BehaviorCell[]): BehaviorOutcome {
	const recorded = cells.filter((item) => item.outcome !== 'missing');
	if (recorded.length === 0) return 'missing';
	return recorded.every((item) => item.outcome === 'passed') ? 'passed' : 'failed';
}

function line(row: ExplorerBehaviorRow): BehaviorLine {
	const { kind, evidence, change, differences } = row;
	const [before, after] = [cell(row.before, row.beforeRead), cell(row.after, row.afterRead)];
	return { kind, evidence, change, differences, before, after };
}

function grouped(rows: ExplorerBehaviorRow[]): BehaviorGroup[] {
	const groups = new Map<string, BehaviorLine[]>();
	for (const row of rows) {
		const key = `${row.scenario}|${row.state}`;
		groups.set(key, [...(groups.get(key) ?? []), line(row)]);
	}
	return [...groups].map(([key, lines]) => {
		const [scenario, state] = key.split('|');
		return {
			scenario,
			state,
			before: outcome(lines.map((item) => item.before)),
			after: outcome(lines.map((item) => item.after)),
			lines
		};
	});
}

/** What one row says happened, in words, with where its content differs when that is known. */
function reason(row: ExplorerBehaviorRow): string[] {
	const said = told[row.change];
	if (!said) return [];
	const where = row.differences.length ? ` at ${row.differences.join(', ')}` : '';
	return [`${row.state}: the recorded ${row.kind} ${said}${where}`];
}

/**
 * The headless results the host found for an entity, arranged for reading: one group for each
 * state, each line with what both sides recorded and, once read, what they hold. The label
 * repeats what the host concluded and nothing is concluded here: unknown stays unknown, results
 * that only differ in bytes are not called a change, and a revision that recorded no result is
 * said to have none and is not passed.
 */
export function entityBehavior(behavior: ExplorerBehavior): EntityBehavior {
	const groups = grouped(behavior.rows);
	const recorded = groups.some((group) => group.after !== 'missing');
	const current = behavior.mode === 'current';
	// A result the host left out as unusable still fails its scenario; the scenario says so.
	const ran = behavior.scenarios.every((scenario) => scenario.after === 'passed');
	const label = current ? 'Current behavior' : labels[behavior.summary];
	const open = ['unknown', 'differs'].includes(behavior.summary);
	return {
		mode: behavior.mode,
		label: recorded || !current ? label : 'No end-to-end result is recorded',
		recorded,
		passed: recorded && ran && groups.every((group) => group.after === 'passed'),
		unknown: open || !recorded,
		groups,
		reasons: [
			...(behavior.reason ? [behavior.reason] : []),
			...(current ? [] : behavior.rows.flatMap(reason))
		],
		scenarios: behavior.scenarios
	};
}

/**
 * How long the end-to-end checks of the given scenarios ran in a record, in words. A record names
 * the job of a scenario test `<scenario>:<test>`, as the host requires of it; a record that holds
 * none of them has no duration, and none is made up for it.
 */
export function behaviorDuration(record: HarnessRecord | null, scenarios: string[]): string | null {
	const jobs = (record?.tests ?? []).filter(
		(test) => test.kind === 'e2e' && scenarios.some((id) => test.id.startsWith(`${id}:`))
	);
	if (jobs.length === 0) return null;
	return `${jobs.reduce((sum, test) => sum + test.durationMs, 0)} ms`;
}

export type {
	BehaviorOutcome,
	BehaviorCell,
	BehaviorLine,
	BehaviorGroup,
	EntityBehavior
} from './entityBehavior.types';
