import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { assertColdEntries } from '../support/coldEntries';
import { measureWorkload } from '../support/measureWorkload';
import { defaultUnitsConfig } from '../../src/core/unitsConfig';

export async function assertIdentityEntries(): Promise<void> {
	await measureWorkload(
		'function.classify-path',
		'classify-source-paths-through-supported-entries',
		() => {
			const source = 'src/services/BillingService.ts';
			const cases = [
				'src/utils/classifyPath.ts',
				'src/utils/classify-path/classifyPath.ts',
				'src/utils/accounts-access/classify-path/classifyPath.ts',
				'src/utils/development-tooling/classify-path/classifyPath.ts'
			];
			assertColdEntries(
				cases.map((entry) => ({
					entry,
					code: `console.log(JSON.stringify(m.classifyPath(${JSON.stringify(source)}, ${JSON.stringify(defaultUnitsConfig)})));`
				})),
				{
					classification: 'source',
					workspace: '',
					workspaceRoot: '.',
					relative: source,
					identity: { id: 'service.billing', kind: 'service', name: 'billing' }
				}
			);
		}
	);
	const entries = [
		'src/utils/unitIdentity.ts',
		'src/utils/accounts-access/unitIdentity.ts',
		'src/utils/development-tooling/classify-path/unitIdentity.ts',
		'src/utils/development-tooling/classify-path/unitIdentity.ts'
	];
	assertColdEntries(
		entries.map((entry) => ({
			entry,
			code: `console.log(JSON.stringify(m.unitIdentity('src/services/BillingService.ts', 'desktop')));`
		})),
		{ id: 'desktop.service.billing', kind: 'service', name: 'billing' }
	);
	// The classify-path forwards removed by this change must not return.
	for (const removed of [
		'src/utils/accounts-access/classify-path/classifyPath.types.ts',
		'src/utils/accounts-access/classify-path/unitIdentity.ts'
	])
		expect(existsSync(resolve(import.meta.dirname, '../..', removed)), removed).toBe(false);
}
