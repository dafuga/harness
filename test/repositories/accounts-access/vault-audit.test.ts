import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { VaultAuditRepository } from '../../../src/repositories/accounts-access/VaultAuditRepository';
import { canary } from '../../support/credential-vault/phone';
import { withTempDir } from '../../support/temporary';

const entry = {
	request: 'a'.repeat(32),
	item: 'b9e3w0',
	site: 'example-console',
	action: 'read-roster',
	method: 'browser' as const,
	recipeDigest: 'c'.repeat(64),
	host: 'mb2'
};

test('the journal is owner-only and tracks outstanding requests and leases', () =>
	withTempDir('vault-audit-', (root) => {
		const directory = join(root, 'state');
		const audit = new VaultAuditRepository(directory);
		audit.append(entry, 'request');
		expect(statSync(directory).mode & 0o777).toBe(0o700);
		expect(statSync(join(directory, 'audit.jsonl')).mode & 0o777).toBe(0o600);
		expect(audit.outstanding().map(({ event }) => event)).toEqual(['request']);
		audit.append(entry, 'delivery');
		audit.append({ ...entry, lease: 'd'.repeat(32) }, 'lease');
		expect(audit.outstanding().map(({ event }) => event)).toEqual(['lease']);
		audit.append({ ...entry, lease: 'd'.repeat(32), cause: 'finished' }, 'lease-end');
		expect(audit.outstanding()).toEqual([]);
		expect(audit.read().map(({ event }) => event)).toEqual([
			'request',
			'delivery',
			'lease',
			'lease-end'
		]);
	}));

test('free text and extra fields never reach the journal', () =>
	withTempDir('vault-audit-', (directory) => {
		const audit = new VaultAuditRepository(directory);
		expect(() => audit.append({ ...entry, cause: canary.password + ' leaked' }, 'revoke')).toThrow(
			'malformed audit record'
		);
		const smuggled = { ...entry, password: canary.password } as typeof entry;
		audit.append(smuggled, 'request');
		expect(readFileSync(join(directory, 'audit.jsonl'), 'utf8')).not.toContain(canary.password);
	}));
