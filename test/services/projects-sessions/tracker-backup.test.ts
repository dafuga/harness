import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { trackerBackupFixture } from '../../support/trackerBackupFixture';

const daily = (names: string[]) =>
	names.filter((name) => /^tracker-\d{4}-\d\d-\d\d\.db\.gz$/.test(name));
const weekly = (names: string[]) => names.filter((name) => name.startsWith('tracker-weekly-'));

test('the hub takes one verified private snapshot a day from 03:30 Lisbon', async () => {
	const hub = await trackerBackupFixture('2026-11-27T03:29:00Z');
	await hub.tick();
	expect(hub.files()).toEqual([]);
	hub.at('2026-11-27T03:31:00Z');
	await hub.tick();
	await hub.tick();
	expect(hub.files()).toEqual(['tracker-2026-11-27.db.gz']);
	const file = join(hub.directory, hub.files()[0]);
	expect(statSync(file).mode & 0o777).toBe(0o600);
	expect(statSync(hub.directory).mode & 0o777).toBe(0o700);
	const copy = join(hub.root, 'copy.db');
	writeFileSync(copy, gunzipSync(readFileSync(file)));
	const database = new DatabaseSync(copy);
	expect(database.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
	expect(database.prepare("SELECT title FROM items WHERE id = 'fixture001'").get()).toEqual({
		title: 'Backed up fixture'
	});
	database.close();
	expect(await hub.api('GET', '/status')).toMatchObject({
		backup: {
			enabled: true,
			stale: false,
			last_ok_file: 'tracker-2026-11-27.db.gz',
			last_error: null
		}
	});
});

test('rotation keeps 14 daily and 8 weekly copies and never touches other hourly copies', async () => {
	const hub = await trackerBackupFixture('2026-09-01T04:00:00Z');
	const hourly = 'tracker-20260901T0300Z.db.gz';
	writeFileSync(join(hub.external, hourly), 'external');
	for (let day = 0; day < 70; day++) {
		hub.at(new Date(Date.parse('2026-09-01T04:00:00Z') + day * 86_400_000).toISOString());
		await hub.tick();
	}
	expect(daily(hub.files())).toHaveLength(14);
	expect(weekly(hub.files())).toHaveLength(8);
	expect(existsSync(join(hub.external, hourly))).toBe(true);
	const listed = await hub.api('GET', '/backup/list');
	expect(listed.files).toContainEqual(expect.objectContaining({ name: hourly, kind: 'hourly' }));
	expect(listed.status).toMatchObject({ enabled: true, counts: { daily: 14, weekly: 8, bad: 0 } });
});

test('a failed backup asks Daniel once and the next good backup closes the ask', async () => {
	const hub = await trackerBackupFixture('2026-11-27T04:00:00Z');
	rmSync(hub.directory, { recursive: true, force: true });
	writeFileSync(hub.directory, 'not a directory');
	expect(await hub.api('POST', '/backup/now')).toMatchObject({ ok: false });
	await hub.api('POST', '/backup/now');
	const [alert, ...others] = hub.alerts();
	expect(others).toEqual([]);
	expect(alert).toMatchObject({ needs_daniel: 1, status: 'open' });
	expect(alert.question).toContain('backup failed');
	expect(JSON.parse(alert.options)).toHaveLength(2);
	rmSync(hub.directory);
	mkdirSync(hub.directory, { mode: 0o700 });
	expect(await hub.api('POST', '/backup/now')).toMatchObject({ ok: true });
	expect(hub.alerts()).toMatchObject([{ status: 'done' }]);
});

test('no good backup for 36 hours raises the stale alert', async () => {
	const hub = await trackerBackupFixture('2026-11-27T04:00:00Z');
	await hub.tick();
	rmSync(hub.directory, { recursive: true, force: true });
	writeFileSync(hub.directory, 'not a directory');
	hub.at('2026-11-28T17:00:00Z');
	await hub.tick();
	expect(await hub.api('GET', '/status')).toMatchObject({ backup: { stale: true } });
	expect(hub.alerts()[0].question).toContain('stale');
});

test('restore prepares a verified database that keeps local run state and gets a new identity', async () => {
	const hub = await trackerBackupFixture('2026-11-27T04:00:00Z');
	const taken = await hub.api('POST', '/backup/now');
	hub.append('fixture002', 'Created after the backup');
	hub.database.exec('CREATE TABLE local_fixture(v TEXT)');
	hub.database.exec("INSERT INTO local_fixture VALUES ('happened')");
	expect(await hub.cli('backup', 'verify', taken.file)).toMatchObject({
		code: 0,
		out: expect.stringContaining('integrity ok')
	});
	const to = join(hub.root, 'restored.db');
	expect(await hub.cli('backup', 'restore', taken.file, '--to', to)).toMatchObject({ code: 0 });
	const restored = new DatabaseSync(to);
	expect(restored.prepare('SELECT id FROM items ORDER BY id').all()).toEqual([
		{ id: 'fixture001' }
	]);
	expect(restored.prepare('SELECT v FROM local_fixture').get()).toEqual({ v: 'happened' });
	expect(restored.prepare("SELECT v FROM meta WHERE k = 'db_id'").get()).not.toEqual({
		v: hub.dbId
	});
	restored.close();
	expect(await hub.cli('backup', 'restore', taken.file, '--to', to)).toMatchObject({ code: 1 });
	expect(hub.database.prepare('SELECT count(*) AS n FROM items').get()).toEqual({ n: 2 });
	const alone = join(hub.root, 'alone.db');
	expect(
		await hub.cli('backup', 'restore', taken.file, '--to', alone, '--without-local-state')
	).toMatchObject({ code: 0 });
	const withoutLive = new DatabaseSync(alone);
	expect(
		withoutLive.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'local_fixture'").get()
	).toBeUndefined();
	withoutLive.close();
	writeFileSync(join(hub.directory, 'broken.db.gz'), 'garbage');
	expect(await hub.cli('backup', 'verify', 'broken.db.gz')).toMatchObject({ code: 1 });
	expect(readdirSync(hub.root).filter((name) => name.includes('.tmp'))).toEqual([]);
});
