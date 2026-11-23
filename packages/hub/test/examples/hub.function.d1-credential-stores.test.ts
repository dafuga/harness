import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { d1CredentialStores } from '../../src/routes/api/[...path]/d1-auth-store-adapter/d1CredentialStores';
import type { D1CredentialStores } from '../../src/utils/networking-security/d1CredentialStores';
import { AuthRecordValidator } from '../../src/validators/accounts-access/AuthRecordValidator';

const folders: string[] = [];
afterEach(() => {
	for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function fixture() {
	const folder = mkdtempSync(join(tmpdir(), 'd1-credential-stores-'));
	folders.push(folder);
	const calls: Array<{ query: string; values: unknown[] }> = [];
	let row: unknown = null;
	const db = {
		prepare(query: string) {
			const statement = {
				bind(...values: unknown[]) {
					bound = values;
					return statement;
				},
				async all<T>(): Promise<{ results: T[] }> {
					return { results: [] };
				},
				async run(): Promise<unknown> {
					calls.push({ query, values: bound });
					return {};
				},
				async first<T = unknown>(): Promise<T | null> {
					calls.push({ query, values: bound });
					return row as T | null;
				}
			};
			let bound: unknown[] = [];
			return statement;
		}
	} satisfies Parameters<typeof d1CredentialStores>[0];
	const records = new AuthRecordValidator() satisfies Parameters<typeof d1CredentialStores>[1];
	const stores: D1CredentialStores = d1CredentialStores(db, records);
	return {
		calls,
		setRow(value: unknown) {
			row = value;
		},
		stores
	};
}

const sessionRecord = {
	idHash: 'hash-session-1',
	kind: 'browser' as const,
	parentHash: null,
	actor: {
		id: 'actor-1',
		email: 'person@example.test',
		name: 'Person',
		emailVerified: true as const
	},
	resource: 'workspace-1',
	createdAt: 100,
	expiresAt: 200,
	revokedAt: null
} satisfies Parameters<D1CredentialStores['sessions']['create']>[0];

test('Creates a session with its stored fields', async () => {
	const { stores, calls } = fixture();
	await stores.sessions.create(sessionRecord);
	expect(calls[0]?.values).toEqual([
		'hash-session-1',
		'browser',
		null,
		'actor-1',
		'person@example.test',
		'Person',
		'workspace-1',
		100,
		200,
		null,
		null,
		null,
		null
	]);
	recordExampleCases(
		{
			unitId: 'hub.function.d1-credential-stores',
			symbol: 'sessions.create',
			state: 'creates-a-session-with-its-stored-fields',
			evidence: 'examples-cases',
			file: 'creates-a-session-with-its-stored-fields.json'
		},
		[
			{
				name: 'browser session with no parent',
				input: sessionRecord,
				output: { query: calls[0]?.query, values: calls[0]?.values }
			}
		]
	);
});

test('Finds and validates a matching session row', async () => {
	const { stores, calls, setRow } = fixture();
	setRow({
		id_hash: 'hash-session-2',
		kind: 'native',
		parent_hash: 'hash-parent',
		actor_id: 'actor-2',
		actor_email: 'native@example.test',
		actor_name: 'Native User',
		resource: 'project:demo',
		created_at: 120,
		expires_at: 240,
		revoked_at: null
	});
	const found = await stores.sessions.find('hash-session-2');
	expect(found).toEqual({
		idHash: 'hash-session-2',
		kind: 'native',
		parentHash: 'hash-parent',
		actor: {
			id: 'actor-2',
			email: 'native@example.test',
			name: 'Native User',
			emailVerified: true
		},
		resource: 'project:demo',
		createdAt: 120,
		expiresAt: 240,
		revokedAt: null
	});
	recordExampleCases(
		{
			unitId: 'hub.function.d1-credential-stores',
			symbol: 'sessions.find',
			state: 'finds-and-validates-a-matching-session-row',
			evidence: 'examples-cases',
			file: 'finds-and-validates-a-matching-session-row.json'
		},
		[
			{
				name: 'matching native session row',
				input: { idHash: 'hash-session-2' },
				output: { result: found, query: calls[0]?.query, values: calls[0]?.values }
			}
		]
	);
});

test('Returns null when no session row matches', async () => {
	const { stores, calls } = fixture();
	const found = await stores.sessions.find('missing-hash');
	expect(found).toBeNull();
	recordExampleCases(
		{
			unitId: 'hub.function.d1-credential-stores',
			symbol: 'sessions.find',
			state: 'returns-null-when-no-session-row-matches',
			evidence: 'examples-cases',
			file: 'returns-null-when-no-session-row-matches.json'
		},
		[
			{
				name: 'no database row',
				input: { idHash: 'missing-hash' },
				output: { result: found, query: calls[0]?.query, values: calls[0]?.values }
			}
		]
	);
});

test('Revokes a session and its unrevoked direct children', async () => {
	const { stores, calls } = fixture();
	await stores.sessions.revoke('hash-parent', 300);
	expect(calls[0]?.values).toEqual([300, 'hash-parent', 'hash-parent']);
	recordExampleCases(
		{
			unitId: 'hub.function.d1-credential-stores',
			symbol: 'sessions.revoke',
			state: 'revokes-a-session-and-its-unrevoked-direct-children',
			evidence: 'examples-cases',
			file: 'revokes-a-session-and-its-unrevoked-direct-children.json'
		},
		[
			{
				name: 'revoke parent and active children',
				input: { idHash: 'hash-parent', now: 300 },
				output: { query: calls[0]?.query, values: calls[0]?.values }
			}
		]
	);
});
