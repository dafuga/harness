import { describe, expect, test } from 'vitest';
import {
	citedRecords,
	inheritedRecords,
	isScopedRecord
} from '../../src/services/verification-evidence/evidence-attach-service/attachDependencies';

const full = {
	id: 'self',
	source: { baseRecord: 'base' },
	scenarios: [{ referencedRecord: 'parent' }, { referencedRecord: null }],
	failures: []
};
const scoped = {
	...full,
	failures: ['Scoped to reports.component.status-badge: only its scenario states ran.']
};

describe('attach dependencies', () => {
	test('a full record inherits its base and scenario parents and cites its ledger', () => {
		expect(isScopedRecord(full)).toBe(false);
		expect(inheritedRecords(full)).toEqual(['base', 'parent']);
		expect(citedRecords(full, ['old', 'self', 'old'])).toEqual(['old']);
	});

	test('a scoped record inherits and cites nothing, so it attaches alone', () => {
		expect(isScopedRecord(scoped)).toBe(true);
		expect(inheritedRecords(scoped)).toEqual([]);
		expect(citedRecords(scoped, ['7b510360a453'])).toEqual([]);
	});
});
