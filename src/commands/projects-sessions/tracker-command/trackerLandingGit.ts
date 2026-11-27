// @harness-uid u_r7qgepnoax
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
const exec = promisify(execFile);
const oid = z.string().regex(/^[a-f0-9]{40}$/);
const pull = z.object({
	baseRefName: z.literal('main'),
	headRefName: z.string(),
	headRefOid: oid,
	isCrossRepository: z.literal(false),
	state: z.enum(['OPEN', 'MERGED', 'CLOSED']),
	isDraft: z.boolean(),
	closingIssuesReferences: z.array(z.unknown()),
	mergeCommit: z.object({ oid }).nullable()
});

export function trackerLandingGit(cwd: string, signal: AbortSignal) {
	const command = landingRunner(cwd, signal);
	const git = (...args: string[]) => command('git', args);
	return {
		async checkout() {
			const branch = await git('symbolic-ref', '--short', 'HEAD');
			if (
				['main', 'master', 'dev', 'staging', 'preprod', 'production'].includes(branch) ||
				(await git('status', '--porcelain'))
			)
				throw new Error('Landing needs a clean feature branch');
			const fetch = repositoryName(await git('remote', 'get-url', 'origin'));
			const push = repositoryName(await git('remote', 'get-url', '--push', '--all', 'origin'));
			if (fetch !== push) throw new Error('Fetch and push must address the same repository');
			return { branch, repo: fetch, sha: oid.parse(await git('rev-parse', 'HEAD')) };
		},
		async base() {
			const output = await git('ls-remote', '--exit-code', 'origin', 'refs/heads/main');
			return oid.parse(output.split(/\s/)[0]);
		},
		async rebase(base: string, original: string) {
			await git('fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main');
			await git('cat-file', '-e', base + '^{commit}');
			await git('update-ref', 'refs/harness/landing-backups/' + original, original);
			try {
				await git('rebase', base);
			} catch (error) {
				await git('rebase', '--abort').catch(() => {});
				throw error;
			}
			await git('merge-base', '--is-ancestor', base, 'HEAD');
			return oid.parse(await git('rev-parse', 'HEAD'));
		},
		async publish(branch: string, expected: string, head: string) {
			if (head !== expected)
				await git(
					'push',
					`--force-with-lease=refs/heads/${branch}:${expected}`,
					'origin',
					`${head}:refs/heads/${branch}`
				);
		},
		async verifyMerged(sha: string, base: string, head: string) {
			await git('fetch', '--no-tags', 'origin', 'refs/heads/main:refs/remotes/origin/main');
			await git('merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main');
			const parent = await git('show', '-s', '--format=%P', sha);
			const checkedTree = await git('rev-parse', head + '^{tree}');
			if (parent !== base || (await git('rev-parse', sha + '^{tree}')) !== checkedTree)
				throw new Error('Squash parent or tree differs from the checked candidate');
		},
		...landingCommands(command)
	};
}

function repositoryName(remote: string) {
	const match =
		/^(?:git@github\.com:|https:\/\/github\.com\/|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/i.exec(
			remote
		);
	if (!match) throw new Error('Landing needs one github.com origin');
	return match[1].toLowerCase();
}

function landingCommands(
	command: (bin: string, args: string[], timeout?: number) => Promise<string>
) {
	return {
		async pull(repo: string, number: number) {
			return pull.parse(
				JSON.parse(
					await command('gh', [
						'pr',
						'view',
						String(number),
						'--repo',
						repo,
						'--json',
						Object.keys(pull.shape).join(',')
					])
				)
			);
		},
		async check(id: string, head: string, base: string) {
			await command('git', ['cat-file', '-e', head + ':scripts/shared-checks.ts']);
			const pkg = JSON.parse(await command('git', ['show', head + ':package.json'])) as {
				scripts?: { check?: string };
			};
			if (pkg.scripts?.check !== 'bun scripts/shared-checks.ts')
				throw new Error('Shared focused check entry point from tzd4cw is required before landing');
			const expectedTree = await command('git', ['rev-parse', head + '^{tree}']);
			const output = await command(
				'bun',
				['run', 'check', '--item', id, '--commit', head, '--exact', '--json'],
				3600000
			);
			verifyReceipt(output, head, base, expectedTree);
		},
		merge(repo: string, pr: number, head: string) {
			return command('gh', [
				'pr',
				'merge',
				String(pr),
				'--repo',
				repo,
				'--squash',
				'--match-head-commit',
				head
			]);
		}
	};
}

function landingRunner(cwd: string, signal: AbortSignal) {
	return async function command(bin: string, args: string[], timeout = 60000) {
		try {
			const result = await exec(bin, args, {
				cwd,
				signal,
				timeout,
				maxBuffer: 8 * 1024 * 1024,
				env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' }
			});
			return result.stdout.trim();
		} catch {
			throw new Error(`Landing command failed: ${bin} ${args[0]}`);
		}
	};
}

function verifyReceipt(output: string, head: string, base: string, expectedTree: string) {
	const receipt = z
		.object({
			schemaVersion: z.literal(1),
			status: z.literal('passed'),
			base: oid,
			commit: oid,
			testedCommit: oid,
			tree: oid
		})
		.parse(JSON.parse(output));
	if (
		receipt.commit !== head ||
		receipt.testedCommit !== head ||
		receipt.base !== base ||
		receipt.tree !== expectedTree
	)
		throw new Error('Shared check did not verify the exact landing tree');
}
