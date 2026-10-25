import { expect, test, vi } from 'vitest';
import { ModuleDataSourceAdapter } from '../../../src/adapters/git-source-history/ModuleDataSourceAdapter';
import { CommitTreeAdapter } from '../../../src/adapters/git-source-history/CommitTreeAdapter';

// Source adapters are tested with immutable object identities, independently of metadata results.
test('historical source text is reused by repository and blob identity, never by path alone', async () => {
	const reads = vi.fn(async (path: string) => (path === 'src/title.ts' ? 'old title' : 'missing'));
	const tree = {
		revision: 'a'.repeat(40),
		list: async () => [{ path: 'src/title.ts', hash: 'old-blob' }],
		read: reads
	};
	const open = vi.spyOn(CommitTreeAdapter, 'open').mockResolvedValue(tree as never);
	try {
		const first = await ModuleDataSourceAdapter.open('/repo-a', 'first');
		expect(await first.read('src/title.ts')).toBe('old title');
		const same = await ModuleDataSourceAdapter.open('/repo-a', 'second');
		expect(await same.read('src/title.ts')).toBe('old title');
		expect(reads, 'Identical immutable blobs are fetched once').toHaveBeenCalledTimes(1);
		const changed = {
			...tree,
			list: async () => [{ path: 'src/title.ts', hash: 'new-blob' }],
			read: vi.fn(async () => 'new title')
		};
		open.mockResolvedValue(changed as never);
		const next = await ModuleDataSourceAdapter.open('/repo-a', 'third');
		expect(await next.read('src/title.ts')).toBe('new title');
		expect(changed.read).toHaveBeenCalledTimes(1);
		const other = await ModuleDataSourceAdapter.open('/repo-b', 'third');
		expect(await other.read('src/title.ts')).toBe('new title');
		expect(changed.read, 'Different repositories keep separate text caches').toHaveBeenCalledTimes(
			2
		);
		await expect(next.read('absent.ts')).rejects.toThrow('does not exist');
	} finally {
		open.mockRestore();
	}
});
