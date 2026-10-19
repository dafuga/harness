import { fail } from '../core/errors';
import type { ImpactReport } from '../core/impactTypes';
import { runtimeKinds, type RuntimeKind } from '../core/unitTypes';
import { ImpactService } from '../services/ImpactService';
import { UnitRuntimeService } from '../services/UnitRuntimeService';
import { openRange } from './loadRevisions';

export interface ImpactOptions {
	root?: string;
	/** Revision to compare from; defaults to `HEAD`. */
	base?: string;
	/** Revision to compare to; defaults to the working tree. */
	head?: string;
	runtime?: string;
}

/** Compares two revisions of this repository and reports what the change affects. */
export async function runImpact(options: ImpactOptions = {}): Promise<ImpactReport> {
	const { root, base, head } = await openRange(options);
	const runtime = new UnitRuntimeService(root).kernel(runtimeKind(options.runtime));
	try {
		return await new ImpactService(runtime).compute(base, head);
	} finally {
		await runtime.close();
	}
}

export function runtimeKind(value: string | undefined): RuntimeKind | 'default' {
	if (value === undefined || value === 'default') return 'default';
	const kind = runtimeKinds.find((item) => item === value);
	return (
		kind ?? fail(`Unknown runtime "${value}". Use one of: default, ${runtimeKinds.join(', ')}.`)
	);
}

export function renderImpact(report: ImpactReport): string {
	const { units, tests, scenarios } = report;
	const total = tests.selected.length + tests.excluded.length;
	const known = scenarios.affected.length + scenarios.unaffected.length;
	return [
		`Impact of ${report.head} against ${report.base} using the ${report.runtime} runtime.`,
		`Changed: ${report.changed.length} files.`,
		`Units: ${units.direct.length} direct, ${units.indirect.length} indirect, ` +
			`${units.added.length} added, ${units.removed.length} removed.`,
		`Tests: ${tests.selected.length} of ${total} tests selected.`,
		...tests.selected.map((path) => `  ${path}`),
		`Scenarios: ${scenarios.affected.length} of ${known} affected.`,
		...scenarios.affected.map((id) => `  ${id}`),
		...(report.expanded ? ['Selection was widened to every test:'] : []),
		...report.uncertain.map((entry) => `  ${entry.reason}: ${entry.node} (${entry.detail})`)
	].join('\n');
}
