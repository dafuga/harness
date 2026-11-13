import { access } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { withTempDir, withTempRepo } from './temporary';

test('withTempDir removes its directory when the callback throws', async () => {
	let created = '';
	const failure = new Error('fixture failure');
	await expect(
		withTempDir('harness-temp-cleanup-', async (directory) => {
			created = directory;
			throw failure;
		})
	).rejects.toBe(failure);
	await expect(access(created)).rejects.toThrow();
});

test('withTempRepo initializes local author identity before returning the repo', async () => {
	await withTempRepo(async ({ git }) => {
		expect(git('config', 'user.name')).toBe('Harness Fixture');
		expect(git('config', 'user.email')).toBe('harness-fixture@example.invalid');
		git('commit', '-q', '--allow-empty', '-m', 'fixture commit');
		expect(git('log', '-1', '--format=%an <%ae>')).toBe(
			'Harness Fixture <harness-fixture@example.invalid>'
		);
	});
});
