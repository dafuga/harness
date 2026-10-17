import type { BrowserDiagnostic } from '../../../../src/core/browserDiagnostics';

type Observed = BrowserDiagnostic['errors'][number];
type Expected = BrowserDiagnostic['expected'][number];
export type BrowserErrorRow = Partial<Observed> & {
	type: Observed['type'];
	message: string;
	status: 'Expected' | 'Unexpected' | 'Missing expected error';
	reason?: string;
};

/** An expectation accounts for one matching occurrence, including its optional exact source. */
export function browserErrorRows(diagnostic: BrowserDiagnostic): BrowserErrorRow[] {
	const waiting = [...diagnostic.expected];
	const rows: BrowserErrorRow[] = diagnostic.errors.map((error) => {
		const index = waiting.findIndex((item) => matches(error, item));
		if (index < 0) return { ...error, status: 'Unexpected' };
		const [expected] = waiting.splice(index, 1);
		return { ...error, status: 'Expected', reason: expected.reason };
	});
	return [
		...rows,
		...waiting.map((item): BrowserErrorRow => ({ ...item, status: 'Missing expected error' }))
	];
}

function matches(error: Observed, expected: Expected): boolean {
	return (
		error.type === expected.type &&
		error.message === expected.message &&
		(expected.source === undefined || error.source === expected.source)
	);
}
