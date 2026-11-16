import { test } from 'vitest';
import {
	renderContractDiff,
	renderContractHistoryJson,
	renderContractLog
} from '../../src/commands/development-tooling/contracts-command/renderContractHistory';
import type {
	ContractDiff,
	ContractLog
} from '../../src/commands/development-tooling/contracts-command/contractHistory.types';
import { recordExampleCases } from '../support/recordExampleCases';
import { expect } from '../verificationExpect';

const diff: ContractDiff = {
	base: 'main~1',
	head: 'main',
	summary: {
		contracts: 1,
		added: 0,
		removed: 0,
		moved: 0,
		changed: 1,
		fields: 1,
		formattingOnlyFiles: 2,
		reorderedOnlyFiles: 1
	},
	total: 1,
	truncated: false,
	changes: [
		{
			id: 'command.example',
			kind: 'changed',
			contractPath: 'specification/units/command.example.json',
			sourcePaths: ['src/commands/example.ts'],
			fieldCounts: { added: 0, removed: 0, changed: 1 },
			fields: [
				{
					path: 'responsibility',
					kind: 'changed',
					before: 'Reads a command input.',
					after: 'Reads and validates a command input.'
				}
			]
		}
	]
};

const log: ContractLog = {
	head: '0123456789abcdef0123456789abcdef01234567',
	identityScope: 'Identity u_example (command.example)',
	scannedCommits: 3,
	truncated: true,
	entries: [
		{
			commit: '89abcdef0123456789abcdef0123456789abcdef',
			date: '2026-10-14',
			author: { name: 'Alex Example', email: 'alex@example.invalid' },
			subject: 'Clarify command input validation',
			summary: diff.summary,
			changes: diff.changes
		}
	]
};

test('Renders semantic diffs with and without field values', () => {
	const detailed = renderContractDiff(diff);
	const summary = renderContractDiff(diff, true);

	expect(detailed).toContain('Comparing main~1 -> main');
	expect(detailed).toContain('responsibility');
	expect(detailed).toContain('Reads');
	expect(detailed).toContain('validates');
	expect(summary).toContain('command.example (changed');
	expect(summary).toContain('+0/-0/~1');
	expect(summary).not.toContain('Reads');

	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts-command-render-contract-history',
			symbol: 'renderContractDiff',
			state: 'renders-semantic-diffs-with-and-without-field-values',
			evidence: 'examples-cases',
			file: 'renders-semantic-diffs-with-and-without-field-values.json'
		},
		[
			{
				name: 'Detailed semantic diff',
				input: { diff, summary: false },
				output: detailed
			},
			{
				name: 'Summary semantic diff',
				input: { diff, summary: true },
				output: summary
			}
		]
	);
});

test('Renders attributed logs with and without field values', () => {
	const detailed = renderContractLog(log);
	const summary = renderContractLog(log, true);

	expect(detailed).toContain(log.identityScope);
	expect(detailed).toContain('Clarify command input validation');
	expect(detailed).toContain('alex@example.invalid');
	expect(detailed).toContain('History limited');
	expect(detailed).toContain('candidate commits');
	expect(detailed).toContain('Reads');
	expect(summary).toContain('command.example (changed');
	expect(summary).not.toContain('Reads');

	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts-command-render-contract-history',
			symbol: 'renderContractLog',
			state: 'renders-attributed-logs-with-and-without-field-values',
			evidence: 'examples-cases',
			file: 'renders-attributed-logs-with-and-without-field-values.json'
		},
		[
			{
				name: 'Detailed attributed history',
				input: { log, summary: false },
				output: detailed
			},
			{
				name: 'Summary attributed history',
				input: { log, summary: true },
				output: summary
			}
		]
	);
});

test('Serializes diffs and logs with optional field summaries', () => {
	const detailedDiff = renderContractHistoryJson(diff);
	const summaryDiff = renderContractHistoryJson(diff, true);
	const detailedLog = renderContractHistoryJson(log);
	const summaryLog = renderContractHistoryJson(log, true);
	const parsedDetailedDiff = JSON.parse(detailedDiff) as ContractDiff;
	const parsedSummaryDiff = JSON.parse(summaryDiff) as ContractDiff;
	const parsedDetailedLog = JSON.parse(detailedLog) as ContractLog;
	const parsedSummaryLog = JSON.parse(summaryLog) as ContractLog;

	expect(parsedDetailedDiff.changes[0].fields).toEqual(diff.changes[0].fields);
	expect(parsedSummaryDiff.changes[0]).toMatchObject({
		id: diff.changes[0].id,
		contractPath: diff.changes[0].contractPath,
		fieldCounts: diff.changes[0].fieldCounts
	});
	expect(parsedSummaryDiff.changes[0]).not.toHaveProperty('fields');
	expect(parsedDetailedLog.entries[0].changes[0].fields).toEqual(log.entries[0].changes[0].fields);
	expect(parsedSummaryLog.entries[0].changes[0]).toMatchObject({
		id: log.entries[0].changes[0].id,
		contractPath: log.entries[0].changes[0].contractPath,
		fieldCounts: log.entries[0].changes[0].fieldCounts
	});
	expect(parsedSummaryLog.entries[0].changes[0]).not.toHaveProperty('fields');

	recordExampleCases(
		{
			unitId: 'command.development-tooling-contracts-command-render-contract-history',
			symbol: 'renderContractHistoryJson',
			state: 'serializes-diffs-and-logs-with-optional-field-summaries',
			evidence: 'examples-cases',
			file: 'serializes-diffs-and-logs-with-optional-field-summaries.json'
		},
		[
			{
				name: 'Full semantic diff JSON',
				input: { result: diff, summary: false },
				output: detailedDiff
			},
			{
				name: 'Summary semantic diff JSON',
				input: { result: diff, summary: true },
				output: summaryDiff
			},
			{
				name: 'Full attributed log JSON',
				input: { result: log, summary: false },
				output: detailedLog
			},
			{
				name: 'Summary attributed log JSON',
				input: { result: log, summary: true },
				output: summaryLog
			}
		]
	);
});
