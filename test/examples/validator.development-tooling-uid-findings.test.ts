import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { uidFindings } from '../../src/validators/development-tooling/uidFindings';
import type { UidFinding } from '../../src/validators/development-tooling/uidFindings';
import type { SourceFile } from '../../src/core/development-tooling/sourceTypes';
import type { ComponentManifest } from '../../src/core/development-tooling/unitTypes';

const uidA = 'u_aaaaaaaaaa';
const uidB = 'u_bbbbbbbbbb';
const uidC = 'u_cccccccccc';
const uidD = 'u_dddddddddd';

function unit(id: string, uid?: string): ComponentManifest {
	return {
		schemaVersion: 1,
		id,
		uid,
		kind: 'validator',
		title: id,
		responsibility: 'Example validator unit',
		responsibilityOrigin: 'declared',
		status: 'active',
		owns: { source: [`src/${id}.ts`], symbols: [] },
		contract: { responsibility: 'Example', inputs: [], outputs: [], errors: [] },
		dependencies: [],
		runtime: { kind: 'module', entry: 'index.ts', targets: [{ kind: 'module', entry: 'index.ts' }] },
		scenarios: [],
		budgets: { size: 'frozen', complexity: 'frozen', performance: [] }
	} as unknown as ComponentManifest;
}

function source(path: string, uid?: string): SourceFile {
	return {
		path, uid, hash: 'abc123', bytes: 10, lines: 1, language: 'typescript',
		classification: 'source', workspace: '.', read: true, decisions: { status: 'counted', count: 0 },
		references: [], blocks: [], exports: [], errors: []
	} as unknown as SourceFile;
}

function summary(findings: UidFinding[]): Array<Pick<UidFinding, 'unit' | 'kind' | 'where'>> {
	return findings.map(({ unit: owner, kind, where }) => ({ unit: owner, kind, where }));
}

test('Finds missing, mismatched, duplicate and copied uids', () => {
	const units = [unit('validator.alpha', uidA), unit('validator.beta', uidB), unit('validator.gamma', uidA), unit('validator.delta'), unit('validator.epsilon', uidC)];
	const files = new Map<string, SourceFile>([
		['src/validator.alpha.ts', source('src/validator.alpha.ts', uidB)],
		['src/validator.beta.ts', source('src/validator.beta.ts')],
		['src/validator.gamma.ts', source('src/validator.gamma.ts', uidA)],
		['src/validator.delta.ts', source('src/validator.delta.ts')],
		['src/validator.epsilon.ts', source('src/validator.epsilon.ts', uidD)]
	]);
	const input = { units: units.map(({ id, uid }) => ({ id, uid })), files: [...files].map(([path, file]) => ({ path, uid: file.uid })) };
	const output = summary(uidFindings(units, files));
	expect(output).toEqual([
		{ unit: 'validator.alpha', kind: 'uid-duplicate', where: 'specification/units/validator.alpha.json' },
		{ unit: 'validator.alpha', kind: 'uid-copied', where: 'src/validator.alpha.ts' },
		{ unit: 'validator.beta', kind: 'uid-missing', where: 'src/validator.beta.ts' },
		{ unit: 'validator.gamma', kind: 'uid-duplicate', where: 'specification/units/validator.gamma.json' },
		{ unit: 'validator.delta', kind: 'uid-missing', where: 'specification/units/validator.delta.json' },
		{ unit: 'validator.epsilon', kind: 'uid-mismatch', where: 'src/validator.epsilon.ts' }
	]);
	recordExampleCases(
		{ unitId: 'validator.development-tooling-uid-findings', symbol: 'uidFindings', state: 'finds-missing-mismatched-duplicate-and-copied-uids', evidence: 'examples-cases', file: 'finds-missing-mismatched-duplicate-and-copied-uids.json' },
		[{ name: 'reports uid gaps across active units and source files', input, output }]
	);
});
