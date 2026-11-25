import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
	Ledger,
	RecordLike,
	ReadLike
} from './desktop.script.ios-acceptance-products.test.types';

export function setupRoot(fake: { root: string; calls: string[]; failOn: string }): string {
	fake.root = mkdtempSync(join(tmpdir(), 'ios-acceptance-products-'));
	fake.calls = [];
	fake.failOn = '';
	return fake.root;
}

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
