import { expect, test } from 'vitest';
import { Command } from 'commander';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { registerHistoryCommand } from '../../src/cli/program/HistoryCommand';
import { previewHistoryPrune } from '../../src/cli/program/history-prune/previewHistory';
import { VerificationStoreRepository } from '../../src/repositories/verification-evidence/VerificationStoreRepository';
import { sealRecord } from '../../src/utils/verification-evidence/sealRecord';
import type { VerificationRecord } from '../../src/core/verification-evidence/verificationTypes';
import { verificationSample } from '../support/verificationSample';
import { withTempRepo } from '../support/temporary';

async function committedRepo(root: string, git: (...args: string[]) => string) {
	await writeFile(join(root, 'seed.txt'), 'fixture\n');
	git('add', 'seed.txt');
	git('commit', '-m', 'fixture');
	return {
		commit: git('rev-parse', 'HEAD'),
		tree: git('rev-parse', 'HEAD^{tree}')
	};
}

async function saveRecord(input: {
	root: string;
	commit: string;
	tree: string;
	startedAt: string;
	idSuffix: string;
}) {
	const sample: Partial<VerificationRecord> = verificationSample();
	delete sample.id;
	const record = sealRecord({
		...sample,
		source: { commit: input.commit, tree: input.tree, base: null },
		startedAt: input.startedAt,
		repository: input.idSuffix.repeat(40).slice(0, 40)
	} as Omit<VerificationRecord, 'id'>);
	const store = new VerificationStoreRepository(input.root);
	await store.save(record, store.directoryFor(input.commit, record.startedAt));
	return record;
}

test('retention matches stay protected and current HEAD is called out', async () =>
	withTempRepo(async ({ root, git }) => {
		const history = registerHistoryCommand(new Command());
		const prune = history.commands.find((command) => command.name() === 'prune')!;
		expect(prune.options.map((option) => option.long)).toEqual(
			expect.arrayContaining(['--keep-last', '--older-than', '--json'])
		);
		expect(prune.options.map((option) => option.long)).not.toContain('--apply');
		expect(prune.description()).toContain('no deletion or --apply mode');
		const head = await committedRepo(root, git);
		const old = await saveRecord({
			root,
			commit: '8'.repeat(40),
			tree: head.tree,
			startedAt: '2020-01-01T00:00:00.000Z',
			idSuffix: 'a'
		});
		const headRecord = await saveRecord({
			root,
			commit: head.commit,
			tree: head.tree,
			startedAt: '2020-02-01T00:00:00.000Z',
			idSuffix: 'b'
		});
		await saveRecord({
			root,
			commit: '9'.repeat(40),
			tree: head.tree,
			startedAt: '2026-11-12T00:00:00.000Z',
			idSuffix: 'c'
		});

		const result = await previewHistoryPrune(root, 1, 30, new Date('2026-11-13T00:00:00.000Z'));
		const oldEntry = result.entries.find((entry) => entry.record === old.id)!;
		const headEntry = result.entries.find((entry) => entry.record === headRecord.id)!;
		expect(result).toMatchObject({
			mode: 'report-only',
			applySupported: false,
			headCommit: head.commit
		});
		expect(oldEntry.retentionMatch).toBe(true);
		expect(oldEntry.protectionReasons.join(' ')).toContain('may still be needed');
		expect(headEntry.retentionMatch).toBe(true);
		expect(headEntry.protectionReasons.join(' ')).toContain('current HEAD');
	}));

test('incomplete and invalid cache directories are reported as protected', async () =>
	withTempRepo(async ({ root, git }) => {
		const { commit } = await committedRepo(root, git);
		const store = join(root, '.cache/harness/verifications');
		const incomplete = join(store, '7'.repeat(40), '20200101000000000');
		const invalid = join(store, '6'.repeat(40), '20200102000000000');
		await mkdir(incomplete, { recursive: true });
		await mkdir(invalid, { recursive: true });
		await writeFile(join(invalid, 'record.json'), '{broken');
		const strayRecord = await saveRecord({
			root,
			commit: '5'.repeat(40),
			tree: git('rev-parse', 'HEAD^{tree}'),
			startedAt: '2020-01-03T00:00:00.000Z',
			idSuffix: 'd'
		});
		await writeFile(
			join(store, '5'.repeat(40), '20200103000000000', 'interrupted.partial'),
			'pending'
		);

		const result = await previewHistoryPrune(root, 0, 1, new Date('2026-11-13T00:00:00.000Z'));
		expect(
			result.entries
				.find((entry) => entry.path.endsWith('20200101000000000'))
				?.protectionReasons.join(' ')
		).toContain('incomplete or in-use');
		expect(
			result.entries
				.find((entry) => entry.path.endsWith('20200102000000000'))
				?.protectionReasons.join(' ')
		).toContain('invalid verification record');
		expect(
			result.entries.find((entry) => entry.record === strayRecord.id)?.protectionReasons.join(' ')
		).toContain('unregistered cache files');
		expect(result.headCommit).toBe(commit);
	}));

test('symlinked run directories are inventoried without following them', async () =>
	withTempRepo(async ({ root, git }) => {
		await committedRepo(root, git);
		const store = join(root, '.cache/harness/verifications');
		const outside = join(root, 'outside');
		await mkdir(store, { recursive: true });
		await mkdir(outside, { recursive: true });
		await writeFile(join(outside, 'record.json'), 'do not read');
		const linked = join(store, '5'.repeat(40), '20200101000000000');
		await mkdir(join(store, '5'.repeat(40)), { recursive: true });
		await symlink(outside, linked);

		const result = await previewHistoryPrune(root, 0, 1, new Date('2026-11-13T00:00:00.000Z'));
		expect(
			result.entries.find((entry) => entry.path.endsWith('20200101000000000'))?.protectionReasons
		).toContain('symlink is not traversed');
		expect(result.applySupported).toBe(false);
	}));
