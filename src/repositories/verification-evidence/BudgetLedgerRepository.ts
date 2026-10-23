import type { LedgerRead } from './BudgetLedgerRepository.types';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { budgetEventSchema, type BudgetEvent } from '../../core/verification-evidence/budgetTypes';
import type { SourceTree } from '../../core/development-tooling/sourceTypes';
import { budgetsLedger } from '../../core/development-tooling/unitsConfig';

/** The append-only budget ledger: one reviewed baseline or approval per line. */
export class BudgetLedgerRepository {
	constructor(private readonly root: string) {}

	/** Reads the ledger of one revision; a missing ledger is an empty one. */
	async read(tree: SourceTree | undefined): Promise<LedgerRead> {
		const listed = (await tree?.list())?.some((entry) => entry.path === budgetsLedger);
		const text = tree && listed ? await tree.read(budgetsLedger) : '';
		const result: LedgerRead = { text, events: [], errors: [] };
		text.split('\n').forEach((line, index) => {
			if (!line.trim()) return;
			const parsed = budgetEventSchema.safeParse(parseLine(line));
			if (parsed.success) result.events.push(parsed.data);
			else result.errors.push(`budget ledger line ${index + 1} is malformed`);
		});
		return result;
	}

	async append(events: BudgetEvent[]): Promise<void> {
		const path = join(this.root, budgetsLedger);
		await mkdir(dirname(path), { recursive: true });
		await appendFile(path, events.map((event) => `${JSON.stringify(event)}\n`).join(''));
	}
}

function parseLine(line: string): unknown {
	try {
		return JSON.parse(line) as unknown;
	} catch {
		return undefined;
	}
}

export type { LedgerRead } from './BudgetLedgerRepository.types';
