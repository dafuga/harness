import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import type { AuditFinding, Block } from '../../src/audit/development-tooling/types';

test('Describes audit findings and source blocks', () => {
	const finding: AuditFinding = {
		path: 'src/example.ts',
		rule: 'types',
		message: 'A type declaration mixes runtime and type code.'
	};
	const block: Block = {
		kind: 'function',
		start: 4,
		end: 8,
		lines: ['function example() {', '\treturn true;', '}']
	};
	expect(finding.rule).toBe('types');
	expect(block.kind).toBe('function');
	recordExampleCases(
		{
			unitId: 'audit.types',
			symbol: 'AuditFinding',
			state: 'describes-audit-findings-and-source-blocks',
			evidence: 'examples-cases',
			file: 'describes-audit-findings-and-source-blocks.json'
		},
		[
			{
				name: 'summarizes a finding',
				input: { path: finding.path, rule: finding.rule },
				output: { rule: finding.rule, message: finding.message }
			},
			{
				name: 'summarizes a source block',
				input: { kind: block.kind, start: block.start, end: block.end },
				output: { kind: block.kind, lineCount: block.lines.length }
			}
		]
	);
});
