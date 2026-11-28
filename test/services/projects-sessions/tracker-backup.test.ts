import { createHash } from 'node:crypto';
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
import { gunzipSync, gzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { trackerHealthBackupChecks } from '../../../src/services/projects-sessions/tracker-health-service/trackerHealthBackupChecks';
import { concurrentBackupWinners, trackerBackupFixture } from '../../support/trackerBackupFixture';

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

test('a failed backup alerts Chief of Staff once and the next good backup closes the ask', async () => {
	const hub = await trackerBackupFixture('2026-11-27T04:00:00Z');
	rmSync(hub.directory, { recursive: true, force: true });
	writeFileSync(hub.directory, 'not a directory');
	expect(await hub.api('POST', '/backup/now')).toMatchObject({ ok: false });
	await hub.api('POST', '/backup/now');
	const [alert, ...others] = hub.alerts();
	expect(others).toEqual([]);
	expect(alert).toMatchObject({ needs_daniel: 0, status: 'open', question: null });
	expect(hub.review(alert.chief_review)).toMatchObject({
		mode: 'chief-only',
		fields: { question: expect.stringContaining('backup failed') }
	});
	rmSync(hub.directory);
	mkdirSync(hub.directory, { mode: 0o700 });
	expect(await hub.api('POST', '/backup/now')).toMatchObject({ ok: true });
	expect(hub.alerts()).toMatchObject([{ status: 'done', chief_review: null }]);
});

test('no good backup for 36 hours raises the stale alert', async () => {
	const hub = await trackerBackupFixture('2026-11-27T04:00:00Z');
	await hub.tick();
	rmSync(hub.directory, { recursive: true, force: true });
	writeFileSync(hub.directory, 'not a directory');
	hub.at('2026-11-28T17:00:00Z');
	await hub.tick();
	expect(await hub.api('GET', '/status')).toMatchObject({ backup: { stale: true } });
	expect(hub.review(hub.alerts()[0].chief_review)?.fields.question).toContain('stale');
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

test('verify and restore read a WAL-mode copy that arrives without its sidecar files', async () => {
	const hub = await trackerBackupFixture('2026-11-27T04:00:00Z');
	// The hourly job uses SQLite's .backup, which keeps the source's WAL journal mode.
	const copy = join(hub.root, 'hourly.db');
	hub.database.exec('PRAGMA journal_mode = WAL');
	hub.database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
	const hourly = 'tracker-20261127T0300Z.db.gz';
	writeFileSync(copy, readFileSync(join(hub.root, 'tracker.db')));
	writeFileSync(join(hub.external, hourly), gzipSync(readFileSync(copy)));
	const file = join(hub.external, hourly);
	expect(hub.bunCli('backup', 'verify', file)).toMatchObject({ code: 0, err: '' });
	const to = join(hub.root, 'restored.db');
	expect(hub.bunCli('backup', 'restore', file, '--to', to)).toMatchObject({ code: 0, err: '' });
});

test('another database never replaces or rotates the backups already in a folder', async () => {
	const hub = await trackerBackupFixture('2026-11-29T15:00:00Z'); // Sunday: also weekly.
	await hub.tick();
	const names = hub.files();
	const contents = () =>
		names.map((name) =>
			createHash('sha256')
				.update(readFileSync(join(hub.directory, name)))
				.digest('hex')
		);
	const before = contents();
	// A rehearsal hub left on the default folder: same day first, then a later day.
	const other = await trackerBackupFixture('2026-11-29T17:00:00Z', hub);
	await other.tick();
	expect(contents()).toEqual(before);
	expect(other.review(other.alerts()[0].chief_review)?.fields.question).toContain(
		'another database'
	);
	other.at('2026-11-30T17:00:00Z');
	expect(await other.api('POST', '/backup/now')).toMatchObject({
		ok: false,
		error: expect.stringContaining('another database')
	});
	expect(hub.files()).toEqual(names);
	expect(contents()).toEqual(before);
	expect(await hub.api('POST', '/backup/now')).toMatchObject({ ok: true });
	expect(await concurrentBackupWinners(hub.root)).toEqual([1]);
}, 20_000);

test('a same-day file from another database or an unreadable one is never replaced', async () => {
	const hub = await trackerBackupFixture('2026-11-27T04:00:00Z');
	const other = await trackerBackupFixture('2026-11-26T04:00:00Z');
	await hub.tick();
	await other.tick();
	const name = 'tracker-2026-11-26.db.gz';
	const path = join(hub.directory, name);
	for (const foreign of [readFileSync(join(other.directory, name)), Buffer.from('garbage')]) {
		writeFileSync(path, foreign);
		hub.at('2026-11-26T05:00:00Z');
		expect(await hub.api('POST', '/backup/now')).toMatchObject({
			ok: false,
			error: expect.stringContaining(name)
		});
		expect(readFileSync(path)).toEqual(foreign);
	}
	expect(hub.files()).toEqual([name, 'tracker-2026-11-27.db.gz']);
});

test('status checks the newest backup on disk and alerts Chief of Staff when it changed', async () => {
	const hub = await trackerBackupFixture('2026-11-27T04:00:00Z');
	await hub.tick();
	const path = join(hub.directory, 'tracker-2026-11-27.db.gz');
	const status = async () => (await hub.api('GET', '/status')).backup;
	expect(await status()).toMatchObject({ stale: false, file_error: null });
	writeFileSync(path, 'replaced');
	expect(await status()).toMatchObject({
		stale: true,
		file_error: expect.stringContaining('is 8 bytes on disk')
	});
	expect(trackerHealthBackupChecks({ backup: await status() })).toMatchObject([
		{ ok: false, severity: 'fail', detail: expect.stringContaining('8 bytes') }
	]);
	await hub.tick();
	await hub.tick();
	expect(hub.alerts()).toMatchObject([{ needs_daniel: 0, question: null }]);
	expect(hub.review(hub.alerts()[0].chief_review)?.fields.question).toContain('8 bytes');
	rmSync(path);
	expect(await status()).toMatchObject({
		stale: true,
		file_error: expect.stringContaining('is missing')
	});
	expect(await hub.api('POST', '/backup/now')).toMatchObject({ ok: true });
	expect(await status()).toMatchObject({ stale: false, file_error: null });
	expect(hub.alerts()).toMatchObject([{ status: 'done' }]);
});
