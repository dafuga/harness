import { readFile } from 'node:fs/promises';
import { test } from 'vitest';
import { BudgetLedgerRepository } from '../../src/repositories/verification-evidence/BudgetLedgerRepository';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const ledgerPath = 'specification/budgets/ledger.ndjson';
const baseline = {
	type: 'baseline' as const,
	unit: 'repository.budget-ledger',
	record: {
		id: 'verify-budget-001',
		commit: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		tree: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
	},
	reviewer: 'Reviewer',
	reason: 'Reviewed initial repository budget',
	at: '2026-11-15T12:00:00.000Z',
	metrics: { 'source-bytes': 4200 },
	performance: []
};

function sourceTree(text: string, includesLedger = true) {
	return {
		revision: 'revision-example',
		list: async () => (includesLedger ? [{ path: ledgerPath, hash: 'c'.repeat(40) }] : []),
		read: async (_path: string) => text
	};
}

test('Reads valid and malformed ledger lines', async () => {
	const text = `${JSON.stringify(baseline)}\nnot-json\n`;
	const tree = sourceTree(text);
	const result = await new BudgetLedgerRepository('.').read(tree);

	expect(result.events).toHaveLength(1);
	expect(result.errors).toEqual(['budget ledger line 2 is malformed']);
	recordExampleCases(
		{
			unitId: 'repository.budget-ledger',
			symbol: 'read',
			state: 'reads-valid-and-malformed-ledger-lines',
			evidence: 'examples-cases',
			file: 'reads-valid-and-malformed-ledger-lines.json'
		},
		[
			{
				name: 'valid event is retained and malformed nonblank line is reported',
				input: { revision: tree.revision, text },
				output: {
					text: result.text,
					eventTypes: result.events.map((event) => event.type),
					errors: result.errors
				}
			},
			{
				name: 'revision without a ledger returns an empty result',
				input: { revision: 'revision-without-ledger' },
				output: await new BudgetLedgerRepository('.').read(sourceTree('', false))
			}
		]
	);
});

test('Appends reviewed events as ledger lines', async () => {
	await withTempDir('budget-ledger-', async (directory) => {
		const repository = new BudgetLedgerRepository(directory);
		await repository.append([baseline]);
		const storedText = await readFile(`${directory}/${ledgerPath}`, 'utf8');
		const result = await repository.read(sourceTree(storedText));

		expect(storedText).toBe(`${JSON.stringify(baseline)}\n`);
		expect(result.events).toEqual([baseline]);
		recordExampleCases(
			{
				unitId: 'repository.budget-ledger',
				symbol: 'append',
				state: 'appends-reviewed-events-as-ledger-lines',
				evidence: 'examples-cases',
				file: 'appends-reviewed-events-as-ledger-lines.json'
			},
			[
				{
					name: 'baseline event is serialized with a trailing newline and read back',
					input: { event: baseline },
					output: { text: storedText, eventCount: result.events.length }
				}
			]
		);
	});
});
