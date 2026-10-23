import type { Engine, Value } from './d1-auth-store.test.types';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type { D1Database } from '@cloudflare/workers-types';
import { expect, test } from 'vitest';
import { createD1AuthStore } from '../../src/adapters/d1-auth-store-adapter/D1AuthStoreAdapter';
import type {
	D1Like,
	D1Statement
} from '../../src/adapters/d1-auth-store-adapter/D1AuthStoreAdapter';
import { emailStoreContract } from '../support/authEmailContract';
import { grantStoreContract } from '../support/authGrantContract';
import { authStoreContract, sessionRecord } from '../support/authStoreContract';
import { memoryAuthStore } from '../support/memoryAuthStore';

/** Real SQLite needs Node 22.5 or newer; on an older runtime these tests report as skipped. */
const sqlite = await import('node:sqlite').catch(() => null);
const files = [
	'0001-auth-ephemeral-state.sql',
	'0003-auth-grant-generations.sql',
	'0004-auth-email-proofs.sql'
];
const migrations = files.map((file) =>
	readFileSync(new URL(`../../db/migrations/${file}`, import.meta.url), 'utf8')
);

function statement(engine: Engine, query: string, values: Value[] = []): D1Statement {
	return {
		bind: (...next) => statement(engine, query, next as Value[]),
		first: async <T>() => (engine.prepare(query).get(...values) ?? null) as T | null,
		run: async () => engine.prepare(query).run(...values)
	};
}

function database(): { db: D1Like; engine: Engine } {
	const engine = new sqlite!.DatabaseSync(':memory:');
	for (const migration of migrations) engine.exec(migration);
	return { db: { prepare: (query) => statement(engine, query) }, engine };
}

authStoreContract('memory', async () => memoryAuthStore());
grantStoreContract('memory', async () => memoryAuthStore());
emailStoreContract('memory', async () => memoryAuthStore());

if (sqlite) {
	authStoreContract('d1', async () => createD1AuthStore(database().db));
	grantStoreContract('d1', async () => createD1AuthStore(database().db));
	emailStoreContract('d1', async () => createD1AuthStore(database().db));
}

test.skipIf(!sqlite)(
	'the migrations apply in order and their documented rollback undoes them',
	() => {
		const { engine } = database();
		engine.exec(migrations[0]);
		engine.exec(migrations[2]);
		const names = (query: string) =>
			engine
				.prepare(query)
				.all()
				.map((row) => row.name);
		const tables = "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name";
		expect(names(tables)).toEqual([
			'auth_challenges',
			'auth_email_proofs',
			'auth_email_sends',
			'auth_email_verified',
			'auth_github_grants',
			'auth_github_states',
			'auth_native_exchanges',
			'auth_sessions'
		]);
		expect(names("SELECT name FROM pragma_table_info('auth_github_grants')")).toEqual(
			expect.arrayContaining(['generation', 'revoked_at', 'refreshing_until'])
		);
		const down = [...migrations]
			.reverse()
			.flatMap((sql) => sql.split('\n').filter((line) => /^-- (DROP|ALTER) /.test(line)));
		engine.exec(down.map((line) => line.slice(3)).join('\n'));
		expect(names(tables)).toEqual([]);
	}
);

test.skipIf(!sqlite)(
	'a row that does not match its record type is refused, not coerced',
	async () => {
		const { db, engine } = database();
		const store = createD1AuthStore(db);
		await store.sessions.create(sessionRecord());
		engine.exec("UPDATE auth_sessions SET expires_at = 'soon' WHERE id_hash = 'session-a'");
		await expect(store.sessions.find('session-a')).rejects.toThrow('Hub auth record corrupt');
		expect(() =>
			engine.exec("UPDATE auth_sessions SET kind = 'admin', expires_at = 5000")
		).toThrow();
	}
);

test('a Cloudflare D1Database satisfies the adapter input type', () => {
	const accepts = (db: D1Like) => db;
	const check = (db: D1Database) => accepts(db);
	expect(check).toBeTypeOf('function');
});

for (const entry of ['utils/d1GrantStore.ts', 'adapters/d1-auth-store-adapter/d1GrantStore.ts']) {
	test(`grant modules initialize from the cold ${entry} entry`, () => {
		const path = new URL(`../../src/${entry}`, import.meta.url).href;
		const code = `const module = await import(${JSON.stringify(path)}); console.log(typeof module.d1GrantStore);`;
		expect(execFileSync('bun', ['-e', code], { encoding: 'utf8' }).trim()).toBe('function');
	});
}

export type { sqlite };
