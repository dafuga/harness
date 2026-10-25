import { join } from 'node:path';
import { gatherCaptures } from './gatherCaptures';
import { readBrowserDiagnostics } from './readBrowserDiagnostics';
import { readCaseResults } from './readCaseResults';

/** A stopped process cannot supply trusted case results, captures or diagnostics. */
export function readCheckEvidence(directory: string, path: string, timedOut: boolean) {
	if (timedOut) return { gathered: [], failures: [], diagnostics: {}, cases: undefined };
	const evidence = join(directory, path);
	const captures = gatherCaptures(evidence, path);
	const diagnostics = readBrowserDiagnostics(evidence);
	const cases = readCaseResults(evidence, path);
	const failures = [diagnostics.failure, cases.failure].flatMap((failure) =>
		failure ? [failure] : []
	);
	return {
		gathered: captures.gathered,
		failures: [...captures.failures, ...failures],
		diagnostics,
		cases: cases.cases
	};
}
