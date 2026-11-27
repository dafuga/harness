import type {
	Ledger,
	ReadLike,
	RecordLike
} from './desktop.script.ios-acceptance-products.test.types';

export function recordOf(): { ledger: Ledger; record: RecordLike } {
	const ledger: Ledger = { begun: [], checks: [] };
	const record = {
		begin: (name: string) => {
			ledger.begun.push(name);
		},
		check: (ok: boolean, text: string) => {
			ledger.checks.push([ok, text]);
		}
	};
	return { ledger, record: record as unknown as RecordLike };
}

export function reading(): ReadLike {
	return { renderer: new Map(), native: new Map(), fixtureComputer: new Map() };
}

export function thrownBy(run: () => unknown): Error {
	try {
		run();
	} catch (error) {
		if (error instanceof Error) return error;
		throw error;
	}
	throw new Error('Expected a thrown error.');
}
