import type { SyncFixture } from './syncFixture.types';

const tables = ['sealed_chain', 'sealed_grants', 'sealed_ops', 'sealed_objects'];

function cell(value: unknown): string | Uint8Array {
	if (value instanceof ArrayBuffer) return new Uint8Array(value);
	if (Array.isArray(value)) return new Uint8Array(value as number[]);
	return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Every value of every row the Hub's D1 database holds for the sealed sync, as text or bytes. */
export async function storedRows(f: SyncFixture): Promise<(string | Uint8Array)[]> {
	const captured: (string | Uint8Array)[] = [];
	for (const table of tables) {
		const rows = await f.db.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>();
		for (const row of rows.results)
			captured.push(JSON.stringify(row), ...Object.values(row).map(cell));
	}
	return captured;
}

/** Every R2 object key and its bytes. */
export async function storedObjects(f: SyncFixture): Promise<(string | Uint8Array)[]> {
	const captured: (string | Uint8Array)[] = [];
	const listed = await f.bucket.list();
	for (const object of listed.objects) {
		captured.push(object.key);
		captured.push(new Uint8Array(await (await f.bucket.get(object.key))!.arrayBuffer()));
	}
	return captured;
}

/** What an account object keeps in its own storage: the replay ring and the sign-in mailbox. */
export async function storedByObject(
	f: SyncFixture,
	account: string
): Promise<(string | Uint8Array)[]> {
	const rows = (await f.objectRows(account)) as Record<string, unknown>[];
	return rows.flatMap((row) => [
		JSON.stringify(row, (_key, value) => (value instanceof ArrayBuffer ? '' : value)),
		...Object.values(row).map(cell)
	]);
}
