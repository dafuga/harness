import type { Settlement } from './settlementReport.types';

/** The answer when what was left could not be established: nothing passes on it. */
export function unknownSettlement(why: string): Settlement {
	const told = 'nothing more was signalled, what the command left is unknown, and the check fails';
	const report = `\n[harness] ${why}: ${told}\n`;
	return { survivors: [], stopped: 0, resisted: 0, unknown: true, report };
}

export { settlementReport } from './run-isolated/settlementReport';

export type { Watched, Settlement, Judged } from './settlementReport.types';
