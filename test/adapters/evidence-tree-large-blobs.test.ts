import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { afterEach, expect, test, vi } from 'vitest';
import { GitAdapter } from '../../src/adapters/git-source-history/GitAdapter';
import {
	EvidenceTreeAdapter,
	batchBufferBytes,
	batchGroups
} from '../../src/adapters/verification-evidence/EvidenceTreeAdapter';
import { BoundedCommandFailure } from '../../src/adapters/execution-runtimes/bounded-command-adapter/commandFailure';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function repository(files: Record<string, Buffer>): { root: string; commit: string } {
	const root = mkdtempSync(join(tmpdir(), 'evidence-blobs-'));
	roots.push(root);
	const git = (...args: string[]) => execFileSync('git', args, { cwd: root }).toString().trim();
	git('init', '-q');
	for (const [name, bytes] of Object.entries(files)) writeFileSync(join(root, name), bytes);
	git('add', '.');
	git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'records');
	return { root, commit: git('rev-parse', 'HEAD') };
}

// Attached verification records reach hundreds of MB; reads size their buffer from git's own
// object sizes instead of the adapter's default cap (verify check crashed on a 480 MB record).
test('evidence reads size their output buffer from the blob sizes', async () => {
	const big = Buffer.alloc(3 * 1024 * 1024, 7);
	const { root, commit } = repository({ 'record.json': big, 'small.txt': Buffer.from('ok') });
	const adapter = new EvidenceTreeAdapter(root);
	const bytes = vi.spyOn(GitAdapter.prototype, 'bytes');
	const many = await adapter.readMany(commit, ['record.json', 'small.txt', 'absent']);
	const batch = bytes.mock.calls.find(([args]) => args.includes('--batch'));
	expect(batch?.[1]?.maxBuffer).toBeGreaterThan(big.length);
	bytes.mockRestore();
	expect(many.get('record.json')?.equals(big)).toBe(true);
	expect(many.get('small.txt')?.toString()).toBe('ok');
	expect(many.has('absent')).toBe(false);
	expect((await adapter.read(commit, 'record.json'))?.length).toBe(big.length);
	expect(await adapter.read(commit, 'absent')).toBeUndefined();
	expect(batchBufferBytes([big.length])).toBeGreaterThan(big.length);
});

test('large batches split into groups under the adapter ceiling', () => {
	const sizes = new Map([
		['a', 900],
		['b', 900],
		['c', 10]
	]);
	expect(batchGroups(['a', 'b', 'c'], sizes, 1500)).toEqual([['a'], ['b', 'c']]);
	expect(batchGroups(['a'], sizes, 10)).toEqual([['a']]);
});

test('a bounded command failure never prints its captured output', () => {
	const failure = new BoundedCommandFailure(
		'Command output limit exceeded.',
		Buffer.alloc(1_000_000, 65),
		'err'
	);
	expect(Object.keys(failure)).not.toContain('stdout');
	expect(failure.stdout.length).toBe(1_000_000);
	expect(failure.stderr).toBe('err');
	expect(inspect(failure).length).toBeLessThan(5_000);
});
