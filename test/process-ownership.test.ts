import { expect, test } from 'vitest';
import { processDescendants, type ProcessRow } from '../src/utils/processDescendants';

/**
 * What a command owns is known by id and start time together. These are tables only: no process
 * is started, and the command is always number 10, leading group 10.
 */
const old = 'Mon Oct 12 10:00:00 2026';
const later = 'Mon Oct 12 10:05:00 2026';
const row = (pid: number, parent: number, group: number, started = old): ProcessRow => ({
	pid,
	parent,
	group,
	started
});
const command = [row(10, 1, 10), row(20, 10, 10)];
/** The follower of command 10, shown one table after the other; the last one stays. */
function following(...tables: ProcessRow[][]) {
	let shown = 0;
	return processDescendants(10, async () => tables[Math.min(shown++, tables.length - 1)]);
}
const ids = (rows: { pid: number }[] | null) =>
	(rows ?? []).map((item) => item.pid).sort((one, other) => one - other);

test('the child of a process that took the id of a followed one is not followed', async () => {
	const followed = following(command, [row(20, 1, 20, later), row(30, 20, 20, later)]);
	expect(ids(await followed.alive())).toEqual([10, 20]);
	expect(ids(await followed.alive())).toEqual([]);
	expect(await followed.survivors()).toEqual([]);
});

test('a process that took the id of the command is not the command, nor is its group', async () => {
	const reused = [row(10, 1, 10, later), row(40, 10, 10, later), row(50, 1, 10, later)];
	const followed = following(command, reused);
	expect(ids(await followed.alive())).toEqual([10, 20]);
	expect(ids(await followed.alive())).toEqual([]);
	expect(await followed.survivors()).toEqual([]);
});

test('a command that ended before it was seen is not found again under its id', async () => {
	const followed = following([row(10, 1, 10, later), row(40, 10, 10, later)]);
	followed.closed();
	expect(ids(await followed.alive())).toEqual([]);
});

test('what is in the group beside one of the command’s own is the command’s', async () => {
	const followed = following(command, [row(20, 1, 10), row(60, 1, 10, later)]);
	await followed.alive();
	const seen = (await followed.alive()) ?? [];
	expect(ids(seen)).toEqual([20, 60]);
	expect(seen.map((item) => item.proven)).toEqual([true, true]);
});

test('a stranger in the group with none of the command’s own beside it is not shown to be its', async () => {
	const followed = following(command, [row(70, 1, 10, later)]);
	await followed.alive();
	expect(await followed.alive()).toEqual([
		{ ...row(70, 1, 10, later), origin: null, proven: false }
	]);
	expect(await followed.survivors()).toEqual([]);
});

test('the parent a process had is remembered by id and start time', async () => {
	const followed = following([...command, row(30, 20, 10)]);
	const seen = (await followed.alive()) ?? [];
	expect(seen.find((item) => item.pid === 30)?.origin).toEqual({ pid: 20, started: old });
	expect(seen.find((item) => item.pid === 10)?.origin).toBeNull();
});
