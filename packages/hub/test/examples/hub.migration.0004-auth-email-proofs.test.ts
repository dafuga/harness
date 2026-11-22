import { readFileSync } from 'node:fs';
import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const migrationUrl = new URL('../../db/migrations/0004-auth-email-proofs.sql', import.meta.url);

test('Defines mailbox proof tables', () => {
	const sql = readFileSync(migrationUrl, 'utf8');
	const tables = ['auth_email_proofs', 'auth_email_sends', 'auth_email_verified'];
	const output = {
		tables: tables.filter((table) => sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`)),
		proofExpiryIndex: sql.includes('auth_email_proofs_expiry'),
		claimedConstraint: sql.includes('CHECK (claimed IN (0, 1))')
	};
	expect(output.tables).toEqual(tables);
	expect(output.proofExpiryIndex).toBe(true);
	expect(output.claimedConstraint).toBe(true);
	recordExampleCases(
		{
			unitId: 'hub.migration.0004-auth-email-proofs',
			symbol: '0004-auth-email-proofs',
			state: 'defines-mailbox-proof-tables',
			evidence: 'examples-cases',
			file: 'defines-mailbox-proof-tables.json'
		},
		[
			{
				name: 'migration declares proof, send-limit, and verified-address tables',
				input: { migration: '0004-auth-email-proofs.sql' },
				output
			}
		]
	);
});
