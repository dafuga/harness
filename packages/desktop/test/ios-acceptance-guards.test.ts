import { expect, test } from 'vitest';
import {
	expiredOffer,
	localOrigin,
	otherVersion,
	redacted,
	scanArgument
} from '../scripts/ios-acceptance-guards';
import { readPairingOffer } from '../../remote/src/index';
import { AcceptanceRecord } from '../scripts/ios-acceptance-record';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { GitAdapter } from '../../../src/adapters/GitAdapter';
import { runCommand } from '../../../test/support/cli';

test('the run talks only to plain http on this machine, by number and with a port', () => {
	expect(localOrigin('http://127.0.0.1:8892')).toBe(true);
	for (const origin of [
		'https://127.0.0.1:8892',
		'http://localhost:8892',
		'http://127.0.0.1',
		'http://127.0.0.1:8892/status',
		'http://127.0.0.1.example.org:8892',
		'http://user@127.0.0.1:8892',
		'http://192.168.1.20:8892',
		'https://relay.example.org'
	])
		expect(localOrigin(origin)).toBe(false);
});

test('a one-time code is hidden with and without its separators, wherever it appears', () => {
	const hidden = redacted('typed ABCD-EFGH, sent ABCDEFGH, kept abcd', ['ABCD-EFGH']);
	expect(hidden).toBe('typed [hidden], sent [hidden], kept abcd');
	expect(redacted('nothing to hide', [])).toBe('nothing to hide');
	expect(redacted('a short one stays: ab', ['ab'])).toBe('a short one stays: ab');
});

test('the offers a run makes wrong are the same offer, refused for exactly the named reason', () => {
	const now = Date.parse('2026-10-13T12:00:00.000Z');
	const fields = `host=${'a'.repeat(40)};pairing=${'b'.repeat(32)};code=KQ7M2XWP`;
	const scan = `harness-pair:v1;aud=harness-phone;env=local;exp=1791893040;${fields};origin=http://127.0.0.1:8891`;
	const read = (text: string) => readPairingOffer(text, { now, environments: ['local'] });
	expect(read(scan)).toHaveProperty('offer');
	expect(read(expiredOffer(scan, now))).toEqual({ refused: 'expired' });
	expect(read(otherVersion(scan))).toEqual({ refused: 'unsupported' });
	expect(expiredOffer(scan, now).replace(/exp=\d+/, '')).toBe(scan.replace(/exp=\d+/, ''));
	expect(scanArgument).toBe('-HarnessSyntheticScans');
});

test('the record counts every assertion and never prints or keeps a code it was told', () => {
	const printed: string[] = [];
	const record = new AcceptanceRecord((line) => printed.push(line));
	record.begin('Pairing');
	record.hide('WXYZ-2345');
	record.check(true, 'the code WXYZ-2345 was entered');
	record.check(0, 'nothing reached the relay');
	record.stopped(new Error('"Connected" did not appear; last seen: WXYZ2345\nstack'));
	expect([record.passed, record.failed]).toEqual([1, 2]);
	expect(record.checks.map((check) => check.phase)).toEqual(['Pairing', 'Pairing', 'Pairing']);
	const everything = JSON.stringify(record.checks) + printed.join('\n');
	expect(everything).not.toMatch(/WXYZ-?2345/);
	expect(everything).not.toContain('stack');
	expect(printed).toContain('FAIL nothing reached the relay');
});

test('native source inventories refuse external metadata and mismatched selected trees', async () => {
	const cache = resolve(import.meta.dirname, '../../../.cache');
	await mkdir(cache, { recursive: true });
	const outside = await mkdtemp(join(tmpdir(), 'native-source-refusal-'));
	const inside = await mkdtemp(join(cache, 'native-source-refusal-'));
	try {
		expect(await refusedSource(outside)).toContain('must stay inside this snapshot cache');
		const git = new GitAdapter(inside);
		await git.run(['init', '--bare', '-q', '.']);
		const tree = await git.run(['mktree'], { input: '' });
		const commit = await git.run([
			'-c',
			'user.name=Harness Fixture',
			'-c',
			'user.email=fixture@harness.invalid',
			'commit-tree',
			tree,
			'-m',
			'Fixture source'
		]);
		await git.run(['update-ref', '--no-deref', 'HEAD', commit]);
		expect(await refusedSource(inside, commit)).toContain(
			'does not match the selected Harness commit and tree'
		);
	} finally {
		await rm(outside, { recursive: true, force: true });
		await rm(inside, { recursive: true, force: true });
	}
});

async function refusedSource(metadata: string, commit = 'unselected') {
	const source = resolve(import.meta.dirname, '../scripts/ios-acceptance-source.ts');
	const result = await runCommand(
		['bun', '--eval', 'const { revision } = await import(process.argv[1]); revision();', source],
		resolve(import.meta.dirname, '..'),
		false,
		{
			HARNESS_NATIVE_SOURCE_GIT_DIR: metadata,
			HARNESS_VERIFY_REVISION: commit,
			HARNESS_VERIFY_TREE: 'different-tree'
		}
	);
	expect(result.exitCode).toBe(1);
	return result.stderr;
}

test('native snapshot inventories include the actual renderer, shell and fixture source', async () => {
	const root = resolve(import.meta.dirname, '../../..');
	const source = new GitAdapter(root);
	const commit = process.env.HARNESS_VERIFY_REVISION ?? (await source.run(['rev-parse', 'HEAD']));
	const objects =
		process.env.HARNESS_VERIFY_GIT_OBJECTS ??
		(await source.run(['rev-parse', '--path-format=absolute', '--git-path', 'objects']));
	const format =
		process.env.HARNESS_VERIFY_GIT_OBJECT_FORMAT ??
		(await source.run(['rev-parse', '--show-object-format']));
	const metadata = await mkdtemp(join(root, '.cache/native-inventory-'));
	try {
		const git = new GitAdapter(metadata);
		await git.run(['init', '--bare', `--object-format=${format}`, '.']);
		await writeFile(join(metadata, 'objects/info/alternates'), objects + '\n');
		await git.run(['update-ref', '--no-deref', 'HEAD', commit]);
		await git.run(['read-tree', 'HEAD']);
		const tree = await git.run(['rev-parse', 'HEAD^{tree}']);
		const program =
			'const { readSources } = await import(process.argv[1]); console.log(JSON.stringify(Object.fromEntries(Object.entries(readSources()).map(([key, files]) => [key, files.size]))));';
		const result = await runCommand(
			[
				'bun',
				'--eval',
				program,
				resolve(import.meta.dirname, '../scripts/ios-acceptance-source.ts')
			],
			resolve(import.meta.dirname, '..'),
			true,
			{
				HARNESS_NATIVE_SOURCE_GIT_DIR: metadata,
				HARNESS_VERIFY_REVISION: commit,
				HARNESS_VERIFY_TREE: tree
			}
		);
		const sizes = JSON.parse(result.stdout);
		for (const kind of ['renderer', 'native', 'fixtureComputer'])
			expect(sizes[kind], 'Native snapshot inventories must contain actual source').toBeGreaterThan(
				0
			);
	} finally {
		await rm(metadata, { recursive: true, force: true });
	}
});
