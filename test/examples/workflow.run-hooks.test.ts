import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import {
	checkMessage,
	manageHooks,
	renderHookOutcome,
	renderHooks,
	runHook
} from '../../src/cli/program/runHooks';
import { recordExampleCases } from '../support/recordExampleCases';
import { withTempRepo } from '../support/temporary';
import { expect } from '../verificationExpect';

test('Manages hook installation, status, and removal for a worktree', async () => {
	await withTempRepo(async ({ root }) => {
		const command = 'bun run dev --';
		const actions = ['install', 'status', 'uninstall'] as const;
		const statuses = [];
		for (const action of actions) statuses.push(await manageHooks(action, command, root));
		const outputs = statuses.map((status) => ({
			installed: status.installed,
			enabled: status.enabled,
			stages: status.stages.map(({ stage, installed, enabled }) => ({ stage, installed, enabled }))
		}));

		expect(outputs.map(({ installed, enabled }) => [installed, enabled])).toEqual([
			[true, true],
			[true, true],
			[false, false]
		]);
		recordExampleCases(
			{
				unitId: 'workflow.run-hooks',
				symbol: 'manageHooks',
				state: 'manages-hook-installation-status-and-removal-for-a-worktree',
				evidence: 'examples-cases',
				file: 'manages-hook-installation-status-and-removal-for-a-worktree.json'
			},
			actions.map((action, index) => ({
				name: `${action} returns the worktree hook state`,
				input: { action, command, root },
				output: outputs[index]
			}))
		);
	});
});

test('Ignores pushed tag refs without starting source verification', async () => {
	await withTempRepo(async ({ root }) => {
		const input =
			'refs/heads/main 0123456789abcdef0123456789abcdef01234567 refs/tags/v1.0.0 89abcdef0123456789abcdef0123456789abcdef\n';
		const output = await runHook('pre-push', input, root);

		expect(output).toEqual({ verified: [], blocked: [] });
		recordExampleCases(
			{
				unitId: 'workflow.run-hooks',
				symbol: 'runHook',
				state: 'ignores-pushed-tag-refs-without-starting-source-verification',
				evidence: 'examples-cases',
				file: 'ignores-pushed-tag-refs-without-starting-source-verification.json'
			},
			[{ name: 'tag update is outside the source branch gate', input: { stage: 'pre-push', input, root }, output }]
		);
	});
});

test('Checks a commit message from a temporary repository file', async () => {
	await withTempRepo(async ({ root }) => {
		const file = join(root, 'COMMIT_EDITMSG');
		await writeFile(file, 'fix: preserve measured hook message\n');
		const output = await checkMessage(file, root);

		expect(output).toEqual([]);
		recordExampleCases(
			{
				unitId: 'workflow.run-hooks',
				symbol: 'checkMessage',
				state: 'checks-a-commit-message-from-a-temporary-repository-file',
				evidence: 'examples-cases',
				file: 'checks-a-commit-message-from-a-temporary-repository-file.json'
			},
			[{ name: 'message passes when the repository has no writing declaration', input: { file, root }, output }]
		);
	});
});

test('Formats installed hook status and local limitations', () => {
	const status = {
		installed: true,
		enabled: true,
		stage: 'pre-push' as const,
		hooksDirectory: '/workspace/project/.git/hooks',
		chained: false,
		stages: [
			{ stage: 'pre-push' as const, installed: true, chained: false, enabled: true },
			{ stage: 'commit-msg' as const, installed: true, chained: false, enabled: true }
		],
		limitations: ['Only pushes of branches are checked; tags and deletions are not.']
	};
	const output = renderHooks(status);

	expect(output).toContain('The pre-push hook is installed');
	expect(output).toContain('Only pushes of branches are checked; tags and deletions are not.');
	recordExampleCases(
		{
			unitId: 'workflow.run-hooks',
			symbol: 'renderHooks',
			state: 'formats-installed-hook-status-and-local-limitations',
			evidence: 'examples-cases',
			file: 'formats-installed-hook-status-and-local-limitations.json'
		},
		[{ name: 'installed status includes both stage guidance and limitation', input: status, output }]
	);
});

test('Formats verified and blocked pre-push commits', () => {
	const input = {
		verified: [
			{
				commit: '0123456789abcdef0123456789abcdef01234567',
				record: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
			}
		],
		blocked: [
			{
				commit: '89abcdef0123456789abcdef0123456789abcdef',
				failures: ['verification failed']
			}
		]
	};
	const output = renderHookOutcome(input);

	expect(output).toEqual([
		'harness: 0123456 is verified by 0123456789ab',
		'harness: push blocked: 89abcde is not verified',
		'  verification failed'
	]);
	recordExampleCases(
		{
			unitId: 'workflow.run-hooks',
			symbol: 'renderHookOutcome',
			state: 'formats-verified-and-blocked-pre-push-commits',
			evidence: 'examples-cases',
			file: 'formats-verified-and-blocked-pre-push-commits.json'
		},
		[{ name: 'successful and failing records become distinct lines', input, output }]
	);
});
