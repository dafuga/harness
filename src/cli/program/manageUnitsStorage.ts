import { createReadStream, readdirSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const unitStoreHeadsUpBytes = 16 * 1024 * 1024;
const budgetLedgerHeadsUpBytes = 2 * 1024 * 1024;

/** Measures the unit JSON store and append-only budget ledger without proposing a policy. */
export async function specificationStorageReport(root: string) {
	const unitFiles = filesBelow(join(root, 'specification', 'units')).filter((path) =>
		path.endsWith('.json')
	);
	const ledger = join(root, 'specification', 'budgets', 'ledger.ndjson');
	const ledgerBytes = fileBytes(ledger);
	const unitBytes = unitFiles.reduce((total, path) => total + fileBytes(path), 0);
	const warnings = [
		...(unitBytes >= unitStoreHeadsUpBytes
			? [`Unit JSON store is at or above the ${unitStoreHeadsUpBytes}-byte operator heads-up.`]
			: []),
		...(ledgerBytes >= budgetLedgerHeadsUpBytes
			? [`Budget ledger is at or above the ${budgetLedgerHeadsUpBytes}-byte operator heads-up.`]
			: [])
	];
	return {
		units: { files: unitFiles.length, bytes: unitBytes },
		budgetLedger: { bytes: ledgerBytes, lines: await lineCount(ledger) },
		operatorHeadsUpBytes: { units: unitStoreHeadsUpBytes, budgetLedger: budgetLedgerHeadsUpBytes },
		warnings
	};
}

function filesBelow(directory: string): string[] {
	return safeEntries(directory).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? filesBelow(path) : entry.isFile() ? [path] : [];
	});
}

function fileBytes(path: string): number {
	try {
		return statSync(path).size;
	} catch {
		return 0;
	}
}

function safeEntries(directory: string) {
	try {
		return readdirSync(directory, { withFileTypes: true });
	} catch {
		return [];
	}
}

async function lineCount(path: string): Promise<number> {
	if (fileBytes(path) === 0) return 0;
	let lines = 0;
	const reader = createInterface({ input: createReadStream(path), crlfDelay: Infinity });
	for await (const _line of reader) lines++;
	return lines;
}
