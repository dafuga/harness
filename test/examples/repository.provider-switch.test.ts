import { request, numbered, sessionId } from './repository.provider-switch.fixture';
import type { Outcome } from './repository.provider-switch.test.types';
import { statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';
import { switchRevision } from '../../src/core/development-tooling/pickerTypes';
import type { SwitchRequest } from '../../src/core/development-tooling/pickerTypes.types';
import { runCommand } from '../support/cli';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir } from '../support/temporary';
import { expect } from '../verificationExpect';

const repositoryFile = fileURLToPath(
	new URL('../../src/repositories/agents-providers/ProviderSwitchRepository.ts', import.meta.url)
);

/** The examples record for one state; the state id also names its evidence file. */
function evidenceOf(state: string, symbol: string) {
	return {
		unitId: 'repository.provider-switch',
		symbol,
		state,
		evidence: 'examples-cases',
		file: `${state}.json`
	};
}

/**
 * Runs in Bun, the runtime of the `bun:sqlite` driver that the repository opens; vitest here runs
 * under Node, so the repository runs in this child. It replays the steps and prints each outcome.
 */
function driver(repository: string): string {
	return `
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { ProviderSwitchRepository } from ${JSON.stringify(repository)};
const { home, steps } = JSON.parse(readFileSync('plan.json', 'utf8'), (k, v) => (v && typeof v === 'object' && '$bigint' in v ? BigInt(v.$bigint) : v));
let store = home ? new ProviderSwitchRepository(home) : null;
const damage = (dir, session) => { const db = new Database(join(dir, 'provider-switches.sqlite')); try { db.query('INSERT INTO switches VALUES (?, ?, ?)').run(session, session + ':x', '{"id":'); } finally { db.close(); } return null; };
const step = ([op, ...args]) => {
	if (op === 'construct') { store?.close(); store = new ProviderSwitchRepository(args[0]); return null; }
	return op === 'damage' ? damage(...args) : store[op](...args) ?? null;
};
const outcomes = steps.map((entry) => { try { return { value: step(entry) }; } catch (error) { return { error: { name: error.name, code: error.code } }; } });
store?.close();
process.stdout.write(JSON.stringify(outcomes));
`;
}

/** Runs the steps in a Bun child against one store (opened at `home` when given). */
async function runSteps(
	directory: string,
	home: string | null,
	steps: unknown[]
): Promise<Outcome[]> {
	writeFileSync(join(directory, 'plan.json'), JSON.stringify({ home, steps }));
	const { stdout } = await runCommand(['bun', '-e', driver(repositoryFile)], directory);
	return JSON.parse(stdout) as Outcome[];
}

test('Opens a private switch store in its home directory', async () => {
	const state = 'opens-a-private-switch-store-in-its-home-directory';
	await withTempDir('provider-switch-examples-', async (directory) => {
		const home = join(directory, 'queue', 'provider-switch');
		const occupied = join(directory, 'occupied');
		writeFileSync(occupied, 'not a directory');
		const [opened, fetched, blocked] = await runSteps(directory, null, [
			['construct', home],
			['get', sessionId],
			['construct', occupied]
		]);
		const mode = (path: string) => (statSync(path).mode & 0o777).toString(8);
		const databaseFile = join(home, 'provider-switches.sqlite');
		const modes = { directoryMode: mode(home), databaseMode: mode(databaseFile) };

		expect(opened).toEqual({ value: null });
		expect(fetched).toEqual({ value: null });
		expect(modes).toEqual({ directoryMode: '700', databaseMode: '600' });
		expect(blocked).toEqual({ error: { name: 'Error', code: 'EEXIST' } });
		recordExampleCases(evidenceOf(state, 'ProviderSwitchRepository.constructor'), [
			{ name: 'Owner-only modes', input: { home: 'queue/provider-switch' }, output: modes },
			{ name: 'Home path is a file', input: { home: 'occupied' }, error: blocked.error }
		]);
	});
});

test('Reads the switch stored for a session, or null', async () => {
	const state = 'reads-the-switch-stored-for-a-session-or-null';
	await withTempDir('provider-switch-examples-', async (directory) => {
		const home = join(directory, 'provider-switch-data');
		const [inserted, , stored, missing, damaged] = await runSteps(directory, home, [
			['put', request('pending'), null],
			['damage', home, 'session-damaged'],
			['get', sessionId],
			['get', 'session-new'],
			['get', 'session-damaged']
		]);

		expect(inserted).toEqual({ value: true });
		expect(stored).toEqual({ value: request('pending') });
		expect(missing).toEqual({ value: null });
		expect(damaged).toEqual({ error: { name: 'SyntaxError' } });
		recordExampleCases(evidenceOf(state, 'ProviderSwitchRepository.get'), [
			{ name: 'Stored switch for the session', input: { sessionId }, output: stored.value },
			{ name: 'Null without a row', input: { sessionId: 'session-new' }, output: missing.value },
			{ name: 'Malformed JSON row', input: { sessionId: 'session-damaged' }, error: damaged.error }
		]);
	});
});

test('Stores a switch; replaces it only for the expected revision', async () => {
	const state = 'stores-a-switch-replaces-it-only-for-the-expected-revision';
	await withTempDir('provider-switch-examples-', async (directory) => {
		const home = join(directory, 'provider-switch-data');
		const revision = switchRevision(request('pending'));
		const [inserted, replaced, stale, unexpected, current] = await runSteps(directory, home, [
			['put', request('pending'), null],
			['put', request('applied'), revision],
			['put', request('cancelled'), revision],
			['put', request('failed'), null],
			['get', sessionId]
		]);
		const flags = [inserted, replaced, stale, unexpected].map((step) => step.value);

		expect(flags).toEqual([true, true, false, false]);
		expect(current).toEqual({ value: request('applied') });
		recordExampleCases(evidenceOf(state, 'ProviderSwitchRepository.put'), [
			{ name: 'Inserts a new session', input: { expectedId: null }, output: flags[0] },
			{ name: 'Replaces on match', input: { expectedId: revision }, output: flags[1] },
			{ name: 'Keeps the row when stale', input: { expectedId: revision }, output: flags[2] },
			{ name: 'Null never matches a row', input: { expectedId: null }, output: flags[3] }
		]);
	});
});

test('Rejects a switch that JSON cannot serialize', async () => {
	const state = 'rejects-a-switch-that-json-cannot-serialize';
	await withTempDir('provider-switch-examples-', async (directory) => {
		const home = join(directory, 'provider-switch-data');
		const revision = switchRevision(request('pending'));
		const bigInt = { ...request('applied'), attempts: { $bigint: '1' } };
		const [inserted, rejected, current] = await runSteps(directory, home, [
			['put', request('pending'), null],
			['put', bigInt, revision],
			['get', sessionId]
		]);

		expect(inserted).toEqual({ value: true });
		expect(rejected).toEqual({ error: { name: 'TypeError' } });
		expect(current).toEqual({ value: request('pending') });
		recordExampleCases(evidenceOf(state, 'ProviderSwitchRepository.put'), [
			{ name: 'BigInt rejected', input: { record: 'bigint' }, error: rejected.error }
		]);
	});
});

test('Lists stored switches newest first, capped at 100', async () => {
	const state = 'lists-stored-switches-newest-first-capped-at-100';
	await withTempDir('provider-switch-examples-', async (directory) => {
		const home = join(directory, 'provider-switch-data');
		const writes = Array.from({ length: 101 }, (_, index) => ['put', numbered(index + 1), null]);
		const outcomes = await runSteps(directory, home, [['list'], ...writes, ['list']]);
		const [, damaged] = await runSteps(directory, home, [
			['damage', home, 'session-damaged'],
			['list']
		]);
		const empty = outcomes[0];
		const last = outcomes[outcomes.length - 1].value as SwitchRequest[];
		const capped = last.map((item) => item.sessionId);
		const summary = { count: capped.length, newest: capped[0], oldest: capped.at(-1) };

		expect(empty).toEqual({ value: [] });
		expect(summary).toEqual({ count: 100, newest: 'session-101', oldest: 'session-002' });
		expect(damaged).toEqual({ error: { name: 'SyntaxError' } });
		recordExampleCases(evidenceOf(state, 'ProviderSwitchRepository.list'), [
			{ name: 'Empty before any write', input: { storedCount: 0 }, output: empty.value },
			{ name: 'Capped at 100, newest first', input: { storedCount: 101 }, output: summary },
			{ name: 'Malformed JSON row', input: { damagedRow: true }, error: damaged.error }
		]);
	});
});

test('Closes the store so later reads fail', async () => {
	const state = 'closes-the-store-so-later-reads-fail';
	await withTempDir('provider-switch-examples-', async (directory) => {
		const home = join(directory, 'provider-switch-data');
		const [inserted, closed, readError, , persisted] = await runSteps(directory, home, [
			['put', request('pending'), null],
			['close'],
			['get', sessionId],
			['construct', home],
			['get', sessionId]
		]);

		expect(inserted).toEqual({ value: true });
		expect(closed).toEqual({ value: null });
		expect(readError).toEqual({ error: { name: 'RangeError' } });
		expect(persisted).toEqual({ value: request('pending') });
		recordExampleCases(evidenceOf(state, 'ProviderSwitchRepository.close'), [
			{ name: 'Closes the connection, no value', input: { storedCount: 1 }, output: closed.value },
			{ name: 'Read after close rejected', input: { sessionId }, error: readError.error },
			{ name: 'Reopened home keeps the switch', input: { sessionId }, output: persisted.value }
		]);
	});
});
