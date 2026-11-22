import { test } from 'vitest';
import { expect } from '../verificationExpect';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempDir, withTempRepo } from '../support/temporary';
import { HistoryIndexService } from '../../src/cli/program/history-index-service/HistoryIndexService';
import type { BuiltHistory, LegacyReader } from '../../src/cli/program/history-index-service/HistoryIndexService.types';

const noLegacy: LegacyReader = async () => [];

function seedCommit(git: (...args: string[]) => string): void {
	git('remote', 'add', 'origin', 'https://github.com/acme/luna-pyramid.git');
	git(
		'-c',
		'user.name=Index Example',
		'-c',
		'user.email=index@example.invalid',
		'commit',
		'--allow-empty',
		'-m',
		'Add the first revision'
	);
}

test('Builds the index of a repository with one commit', async () => {
	await withTempRepo(async (repository) => {
		seedCommit(repository.git);
		await withTempDir('history-index-build-', async (directory) => {
			const out = `${directory}/history`;
			const built: BuiltHistory = await new HistoryIndexService(repository.root).build(
				out,
				10,
				noLegacy
			);
			expect(built.out).toBe(out);
			expect(built.digest).toMatch(/^[0-9a-f]{64}$/);
			expect(built.media).toEqual({ resolved: 0, missing: 0 });
			expect(built.problems).toEqual([]);
			expect(built.index.sourceRepository).toBe('https://github.com/acme/luna-pyramid');
			expect(built.index.revisions).toHaveLength(1);
			expect(built.index.legacy).toEqual([]);
			expect(built.catalog).toBe(`${out}/catalog.sqlite`);
			recordExampleCases(
				{
					unitId: 'service.history-index',
					symbol: 'build',
					state: 'builds-the-index-of-a-repository-with-one-commit',
					evidence: 'examples-cases',
					file: 'builds-the-index-of-a-repository-with-one-commit.json'
				},
				[
					{
						name: 'one commit with a GitHub origin and no legacy entries',
						input: { limit: 10, legacyEntries: 0 },
						output: {
							out: 'history',
							media: built.media,
							problems: built.problems,
							sourceRepository: built.index.sourceRepository,
							revisions: built.index.revisions.length,
							legacy: built.index.legacy
						}
					}
				]
			);
		});
	});
});

test('Rejects when the legacy reader rejects', async () => {
	await withTempRepo(async (repository) => {
		seedCommit(repository.git);
		await withTempDir('history-index-legacy-', async (directory) => {
			const failing: LegacyReader = async () => {
				throw new Error('legacy entries are unreadable');
			};
			let error: unknown;
			try {
				await new HistoryIndexService(repository.root).build(`${directory}/history`, 10, failing);
			} catch (caught) {
				error = caught;
			}
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toBe('legacy entries are unreadable');
			recordExampleCases(
				{
					unitId: 'service.history-index',
					symbol: 'build',
					state: 'rejects-when-the-legacy-reader-rejects',
					evidence: 'examples-cases',
					file: 'rejects-when-the-legacy-reader-rejects.json'
				},
				[
					{
						name: 'legacy callback rejection passes through build unchanged',
						input: { limit: 10 },
						error: {
							name: (error as Error).name,
							message: (error as Error).message
						}
					}
				]
			);
		});
	});
});
