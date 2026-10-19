import { afterEach, test, vi } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EvidenceTreeAdapter } from '../src/adapters/EvidenceTreeAdapter';
import { recordCapture } from '../src/utils/record-capture/recordCapture';
import { expect } from './verificationExpect';

afterEach(() => vi.restoreAllMocks());

async function binaryRepo(tree: EvidenceTreeAdapter, root: string) {
	await tree.git.run(['init', '-b', 'main']);
	await tree.git.run(['config', 'user.name', 'Harness Evidence Fixture']);
	await tree.git.run(['config', 'user.email', 'fixture@example.invalid']);
	const binary = Buffer.from([0, 10, 255, 0, 13]),
		text = Buffer.from('recorded output\n');
	await mkdir(join(root, 'logs'));
	await mkdir(join(root, 'media'));
	await writeFile(join(root, 'logs/a.txt'), text);
	await writeFile(join(root, 'logs/copy.txt'), text);
	await writeFile(join(root, 'media/binary\nname.png'), binary);
	await tree.git.run(['add', '--all']);
	await tree.git.run(['-c', 'commit.gpgsign=false', 'commit', '-m', 'chore: seed binary evidence']);
	return { binary, text, commit: await tree.git.run(['rev-parse', 'HEAD']) };
}

test('one batch reads exact binary evidence, duplicate blobs and unusual paths at a pinned commit', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-evidence-batch-'));
	try {
		const tree = new EvidenceTreeAdapter(root);
		const { commit, text, binary } = await binaryRepo(tree, root);
		const read = vi.spyOn(tree.git, 'exec');
		const paths = ['logs/a.txt', 'logs/copy.txt', 'media/binary\nname.png', 'missing'];
		const result = await tree.readMany(commit, paths);
		expect([...result.keys()]).toEqual(paths.slice(0, -1));
		expect(result.get(paths[0])).toEqual(text);
		expect(result.get(paths[1])).toEqual(text);
		expect(result.get(paths[2])).toEqual(binary);
		const batches = read.mock.calls.filter(([args]) => args[0] === 'cat-file');
		expect(batches).toHaveLength(1);
		expect(batches[0][0]).toEqual(['cat-file', '--batch']);
		expect(String(batches[0][1]?.input).trim().split('\n')).toHaveLength(2);
		recordCapture(
			{
				evidence: 'batch-read-cases',
				kind: 'assertions',
				state: 'binary-read',
				file: 'binary-read.json',
				mediaType: 'application/json'
			},
			JSON.stringify({
				scenario: 'Read pinned evidence through Git',
				input: { commit, paths },
				output: {
					filesRead: [...result.keys()],
					binaryBytes: [...result.get(paths[2])!],
					blobReaderProcesses: batches.length
				}
			})
		);
		result.get(paths[0])![0] = 0;
		expect(result.get(paths[1])).toEqual(text);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test('a malformed, mismatched, truncated or non-blob batch never yields evidence', async () => {
	const tree = new EvidenceTreeAdapter(tmpdir());
	const hash = 'a'.repeat(64);
	vi.spyOn(tree, 'list').mockResolvedValue(new Map([['record', hash]]));
	const read = vi.spyOn(tree.git, 'bytes');
	read.mockResolvedValue(Buffer.from(`${hash} blob 1\nx\n`));
	expect(await tree.readMany('pinned', ['record'])).toEqual(
		new Map([['record', Buffer.from('x')]])
	);
	const invalid = [
		'',
		`${hash} tree 1\nx\n`,
		`${'b'.repeat(64)} blob 1\nx\n`,
		`${hash} missing\n`,
		`${hash} blob 9007199254740992\n`,
		`${hash} blob 4\nx\n`,
		`${hash} blob 1\nx!`,
		`${hash} blob 1\nx\nextra`
	];
	for (const bytes of invalid) {
		read.mockResolvedValue(Buffer.from(bytes));
		await expect(tree.readMany('pinned', ['record'])).rejects.toThrow('Invalid Git batch response');
	}
});

test('empty requests and absent paths do not start a blob reader', async () => {
	const tree = new EvidenceTreeAdapter(tmpdir());
	vi.spyOn(tree, 'list').mockResolvedValue(new Map());
	const read = vi.spyOn(tree.git, 'bytes');
	expect(await tree.readMany('pinned', [])).toEqual(new Map());
	expect(await tree.readMany('pinned', ['missing'])).toEqual(new Map());
	expect(read).not.toHaveBeenCalled();
});

test('a Git read failure is reported rather than returned as empty successful evidence', async () => {
	const tree = new EvidenceTreeAdapter(tmpdir());
	vi.spyOn(tree, 'list').mockResolvedValue(new Map([['record', 'a'.repeat(40)]]));
	vi.spyOn(tree.git, 'bytes').mockRejectedValue(new Error('Git object unavailable'));
	await expect(tree.readMany('pinned', ['record'])).rejects.toThrow('Git object unavailable');
});
