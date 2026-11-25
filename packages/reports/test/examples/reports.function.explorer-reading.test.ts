import { test } from 'vitest';
import {
	artifactDifferences,
	explorerReading
} from '../../src/utils/explorer-reading/explorerReading';
import { capture } from '../explorerFixture';
import { expect } from '../../../../test/verificationExpect';
import {
	read,
	run,
	record,
	outcome,
	behavior,
	served,
	requested,
	base,
	fetcher
} from './reports.function.explorer-reading.cases';

test('scoped commit reads of a different answer are changed and name the path that differs', async () => {
	const shown = await read(run(['hello world']), run(['HELLO WORLD']));
	expect(shown.summary).toBe('changed');
	expect(shown.rows[0]).toMatchObject({ change: 'changed', differences: ['output[0]'] });
	expect(shown.rows[0].beforeRead?.behavior?.output).toEqual(['hello world']);
	expect(shown.rows[0].afterRead?.behavior?.output).toEqual(['HELLO WORLD']);
	record('explorerReading', 'explorer-reading-commit-different-answer-changed', [
		{
			name: 'different output is a changed path',
			input: { mode: 'commit', before: 'hello world', after: 'HELLO WORLD' },
			output: outcome(shown)
		}
	]);
});

test('actual current reads are shown with their output but are not compared', async () => {
	const shown = await read(null, run(['a']), 'current');
	expect(shown.summary).toBe('not-compared');
	expect(shown.rows[0]).toMatchObject({ change: 'unknown', beforeRead: null });
	expect(shown.rows[0].afterRead?.verified).toBe(true);
	expect(shown.rows[0].afterRead?.behavior?.output).toEqual(['a']);
	record('explorerReading', 'explorer-reading-current-read-uncompared', [
		{
			name: 'current read keeps its output uncompared',
			input: { mode: 'current', before: null, after: 'a' },
			output: outcome(shown)
		}
	]);
});

const appearedState = 'explorer-reading-appeared-and-removed-results';
test('a result that appeared or was removed keeps its standing, with the missing side null', async () => {
	const added = await read(null, run(['a']));
	const removed = await read(run(['a']), null);
	expect(added.rows[0]).toMatchObject({ change: 'added', beforeRead: null });
	expect(added.rows[0].afterRead?.verified).toBe(true);
	expect(added.summary).toBe('changed');
	expect(removed.rows[0]).toMatchObject({ change: 'removed', afterRead: null });
	expect(removed.summary).toBe('changed');
	record('explorerReading', appearedState, [
		{ name: 'added result', input: { before: null }, output: outcome(added) },
		{ name: 'removed result', input: { after: null }, output: outcome(removed) }
	]);
});

const unreadState = 'explorer-reading-unreadable-tampered-and-unstored-results';
test('loading, tampered and unstored results stay unknown, and a stored hash is fetched once', async () => {
	const same = behavior(run(['a']), run(['a']));
	served.clear();
	requested.length = 0;
	const missing = await explorerReading(same, base, fetcher);
	expect(missing).toMatchObject({
		summary: 'unknown',
		reason: 'A recorded result could not be read and checked, so it is not compared.'
	});
	expect(missing.rows[0]).toMatchObject({ change: 'unknown' });
	expect(missing.rows[0].afterRead?.problem).toBe('The artifact could not be read (404).');
	expect(requested, 'one distinct hash is fetched once').toHaveLength(1);

	const tampered = behavior(run(['a']), run(['b']));
	served.set(`${tampered.rows[0].after?.sha256}.json`, 'tampered');
	const altered = await explorerReading(tampered, base, fetcher);
	expect(altered.summary).toBe('unknown');
	expect(altered.rows[0].afterRead).toMatchObject({ verified: false, text: 'tampered' });

	const unstored = behavior(run(['a']), null);
	unstored.rows[0].after = capture({ media: null, gap: 'The run was not stored.' });
	const absent = await explorerReading(unstored, base, fetcher);
	expect(absent.rows[0].afterRead?.problem).toBe('The run was not stored.');
	expect(absent.summary).toBe('unknown');

	const noted = { ...same, summary: 'unknown' as const, reason: 'Source moved.' };
	const kept = await explorerReading(noted, base, fetcher);
	expect(kept).toMatchObject({ summary: 'unknown', reason: 'Source moved.' });
	record('explorerReading', unreadState, [
		{ name: 'missing bytes', input: { before: 'a', after: 'a' }, output: outcome(missing) },
		{ name: 'tampered bytes', input: { before: 'a', after: 'b' }, output: outcome(altered) },
		{ name: 'not stored', input: { after: 'a' }, output: outcome(absent) },
		{ name: 'supplied reason kept', input: { summary: 'unknown' }, output: outcome(kept) }
	]);
});

const differencesState = 'explorer-reading-artifact-differences-declared-metadata';
test('artifact differences set aside only supported declared metadata and name other paths', () => {
	const declared = (pid: unknown) => ({
		output: ['a'],
		harnessRun: { version: 1, startedAt: '2026-10-10T10:00:00Z', durationMs: 3, pid }
	});
	const undeclared = (stamp: number) => ({ output: ['a'], startedAt: stamp, durationMs: stamp });
	const found = {
		metadata: artifactDifferences(declared(1), declared(2)),
		undeclared: artifactDifferences(undeclared(1), undeclared(9)),
		notAKind: artifactDifferences(declared('x'), declared('y')),
		text: artifactDifferences('one', 'two')
	};
	expect(found.metadata).toEqual([]);
	expect(found.undeclared).toEqual(['durationMs', 'startedAt']);
	expect(found.notAKind, 'wrong kind is compared').toEqual(['harnessRun.pid']);
	expect(found.text, 'text that is not a document is compared whole').toEqual(['']);
	record('artifactDifferences', differencesState, [
		{ name: 'declared metadata set aside', input: { metadata: true }, output: found.metadata },
		{ name: 'undeclared times counted', input: { undeclared: true }, output: found.undeclared },
		{ name: 'wrong-kind pid kept', input: { notAKind: true }, output: found.notAKind },
		{ name: 'text compared whole', input: { text: true }, output: found.text }
	]);
});
