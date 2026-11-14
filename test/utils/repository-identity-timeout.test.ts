import { realpathSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, test, vi } from 'vitest';
import { BoundedCommandAdapter } from '../../src/adapters/execution-runtimes/BoundedCommandAdapter';
import {
	repositoryIdentity,
	sameSite
} from '../../src/utils/accounts-access/repository-identity/repositoryIdentity';
import { withTempDir } from '../support/temporary';
import { measureWorkload } from '../support/measureWorkload';

afterEach(() => vi.restoreAllMocks());

test('a timed out identity probe does not cache an unknown repository', async () => {
	const directory = `/synthetic/identity-retry-${randomUUID()}`;
	const run = vi
		.spyOn(BoundedCommandAdapter.prototype, 'runSync')
		.mockImplementationOnce(() => {
			throw Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
		})
		.mockImplementation((_command, args = []) => {
			const question = args.slice(2).join(' ');
			if (question === 'rev-parse --path-format=absolute --git-common-dir')
				return result('/git/common');
			if (question === 'remote') return result('origin');
			if (question === 'remote get-url origin')
				return result('https://github.com/synthetic/retry.git');
			return { code: 128, stdout: Buffer.alloc(0), stderr: 'not a repository' };
		});

	expect(repositoryIdentity(directory)).toBeNull();
	expect(
		await measureWorkload('utility.repository-identity', 'identity-after-timeout', () =>
			repositoryIdentity(directory)
		)
	).toMatch(/^[0-9a-f]{64}$/);
	expect(run).toHaveBeenCalledTimes(5);
});

test('a timed out plain-site probe is retried rather than cached as unknown', async () =>
	withTempDir('identity-timeout-', async (temporary) => {
		const directory = realpathSync(temporary);
		let plainProbe = 0;
		const run = vi
			.spyOn(BoundedCommandAdapter.prototype, 'runSync')
			.mockImplementation((_command, args = []) => {
				const question = args.slice(2).join(' ');
				if (question === 'rev-parse --path-format=absolute --git-common-dir')
					return { code: 128, stdout: Buffer.alloc(0), stderr: 'not a repository' };
				if (question === 'rev-parse --git-dir') {
					plainProbe++;
					if (plainProbe === 1) throw Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
					return { code: 128, stdout: Buffer.alloc(0), stderr: 'not a repository' };
				}
				return { code: 128, stdout: Buffer.alloc(0), stderr: 'not a repository' };
			});

		expect(sameSite(directory, directory)).toBe(false);
		expect(sameSite(directory, directory)).toBe(true);
		expect(plainProbe).toBe(2);
		expect(run).toHaveBeenCalledTimes(4);
	}));

function result(value: string) {
	return { code: 0, stdout: Buffer.from(value + '\n'), stderr: '' };
}
