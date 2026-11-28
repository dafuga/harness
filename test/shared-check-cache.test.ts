import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'vitest';

const script = `
			import { CheckQueue } from ${JSON.stringify(resolve('scripts/shared-checks/checkQueue.ts'))};
			import { SharedCheckCache } from ${JSON.stringify(resolve('scripts/shared-checks/checkCache.ts'))};
			import { withSharedCheckLease } from ${JSON.stringify(resolve('scripts/shared-checks/checkLease.ts'))};
			import { checkGit } from ${JSON.stringify(resolve('scripts/shared-checks/checkGit.ts'))};
			const [repo, folder, remote] = process.argv.slice(1);
			const firstHost = new CheckQueue(folder + '/first-host');
			const secondHost = new CheckQueue(folder + '/second-host');
			const tree = checkGit(repo, ['hash-object', '-t', 'tree', '--stdin'], '');
			const candidate = { repo, tree, base: '', commit: '' };
			const check = { id: 'unit', command: ['bun', 'unit.ts'] };
			const writer = new SharedCheckCache(firstHost, candidate, remote);
			const reader = new SharedCheckCache(secondHost, candidate, remote);
			const { signal } = new AbortController();
			let executions = 0;
			const executed = await Promise.all([writer, reader].map((cache) =>
				withSharedCheckLease(candidate, remote, signal, async () => {
					cache.readShared([check]);
					if (cache.source(check)) return false;
					executions++;
					await Bun.sleep(75);
					cache.save(check);
					cache.publish([check]);
					return true;
				})
			));
			const modified = { ...check, command: ['bun', 'changed.ts'] };
			const differentTree = new SharedCheckCache(secondHost, { ...candidate, tree: 'a'.repeat(40) }, remote);
			reader.readShared([check, modified]);
			differentTree.readShared([check]);
			const refs = checkGit(remote, ['for-each-ref', '--format=%(objectname)', 'refs/harness/check-cache']);
			console.log(JSON.stringify({
				local: writer.source(check), remote: reader.source(check),
				executions, executed,
				inflight: checkGit(remote, ['for-each-ref', '--format=%(refname)', 'refs/harness/check-inflight']),
				changed: reader.source(modified), differentTree: differentTree.source(check),
				receiptContents: checkGit(remote, ['ls-tree', refs])
			}));
			firstHost.close();
			secondHost.close();
		`;

test('two host databases reuse only the exact tree and check receipt from a shared Git remote', () => {
	const folder = mkdtempSync(join(tmpdir(), 'harness-git-check-cache-'));
	try {
		const repo = join(folder, 'repo');
		const remote = join(folder, 'remote');
		mkdirSync(repo);
		execFileSync('git', ['init', '-q', '--bare', remote]);
		execFileSync('git', ['-C', repo, 'init', '-q']);

		const out = execFileSync('bun', ['-e', script, repo, folder, remote], {
			encoding: 'utf8',
			timeout: 30_000
		});
		expect(JSON.parse(out)).toEqual({
			local: 'local-cache',
			remote: 'shared-cache',
			receiptContents: '',
			executions: 1,
			executed: [true, false],
			inflight: ''
		});
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}, 35_000);
