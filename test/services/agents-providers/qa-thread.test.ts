import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { withTempDir } from '../../support/temporary';
import type { World } from './qa-thread.test.types';
import type { GitHubAppAdapter } from '../../../src/adapters/agents-providers/GitHubAppAdapter';
import type { QaThreadPorts } from '../../../src/core/agents-providers/qaThread.types';
import { QaLedgerRepository } from '../../../src/repositories/agents-providers/QaLedgerRepository';
import { QaEligibilityService } from '../../../src/services/agents-providers/QaEligibilityService';
import { QaThreadService } from '../../../src/services/agents-providers/QaThreadService';
import {
	parseQaSteps,
	qaParentText,
	qaStepsText
} from '../../../src/services/agents-providers/qa-thread-service/qaThreadText';

function github(world: World): GitHubAppAdapter {
	const read = async (path: string) => {
		if (path === '/repos/o/r/issues/5')
			return {
				state: world.open ? 'open' : 'closed',
				title: 'Logo saves',
				html_url: 'https://github.com/o/r/issues/5',
				body: 'Steps to reproduce: open settings, pick a logo, click save once and reload the page.',
				labels: world.labelled ? [{ name: 'needs testing on staging' }] : []
			};
		if (path === '/search/issues')
			return {
				items: [
					{ number: 9, title: 'Fix logo', body: 'Refs #5' },
					{ number: 8, title: 'Other', body: 'mentions #5' }
				]
			};
		if (path === '/repos/o/r/pulls/9')
			return {
				merged: true,
				number: 9,
				html_url: 'https://github.com/o/r/pull/9',
				merge_commit_sha: 'abc1234def'
			};
		if (path.startsWith('/repos/o/r/compare/'))
			return { status: world.stagingContainsFix ? 'ahead' : 'behind' };
		if (path === '/repos/o/r/issues/5/comments')
			return world.retest
				? [
						{
							author_association: 'MEMBER',
							body: 'Ready to retest on staging: upload two logos, save.'
						}
					]
				: [];
		throw new Error('unexpected ' + path);
	};
	return { repoPath: '/repos/o/r', repoQualifier: 'repo:o/r', read } as unknown as GitHubAppAdapter;
}

const good: World = { stagingContainsFix: true, open: true, labelled: true, retest: true };
const eligibility = (world: World) =>
	new QaEligibilityService(github(world), 'needs testing on staging', 'staging');

describe('QaEligibilityService gate', () => {
	test('accepts an open, labelled issue whose merged fix is an ancestor of staging', async () => {
		const verdict = await eligibility(good).evaluate(5);
		expect(verdict).toMatchObject({
			eligible: true,
			task: { fixPr: 9, instructionsSource: 'retest-comment' }
		});
	});

	test.each([
		[{ ...good, open: false }, 'issue-closed'],
		[{ ...good, labelled: false }, 'label-missing'],
		[{ ...good, stagingContainsFix: false }, 'fix-not-on-staging']
	])('rejects %j as %s', async (world, reason) => {
		expect(await eligibility(world).evaluate(5)).toEqual({ eligible: false, reason });
	});

	test('falls back to the issue reproduction steps when there is no retest comment', async () => {
		const verdict = await eligibility({ ...good, retest: false }).evaluate(5);
		expect(verdict).toMatchObject({ eligible: true, task: { instructionsSource: 'issue-steps' } });
	});
});

describe('QaThreadService', () => {
	const steps = [{ action: 'Open settings', expected: 'The logo field shows' }];
	function ports(posts: string[]): QaThreadPorts {
		return {
			writeSteps: async () => steps,
			record: async () => '/tmp/v.mp4',
			post: async (t) => (posts.push(t.parent), { channelId: 'C1', parentTs: '1.2' }),
			linkBack: async () => undefined
		};
	}

	test('posts one thread per label event and dedupes redelivery and relabelling', () =>
		withTempDir('qa-ledger-', async (dir) => {
			const ledger = new QaLedgerRepository(join(dir, 'ledger.jsonl'));
			const posts: string[] = [];
			const service = new QaThreadService(eligibility(good), ledger, ports(posts), {
				stagingUrl: 'https://s.test',
				stagingBranch: 'staging'
			});
			expect(await service.handleLabel({ eventId: 'e1', issue: 5 })).toMatchObject({
				status: 'posted'
			});
			expect(await service.handleLabel({ eventId: 'e1', issue: 5 })).toEqual({
				status: 'skipped',
				reason: 'duplicate'
			});
			expect(await service.handleLabel({ eventId: 'e2', issue: 5 })).toEqual({
				status: 'skipped',
				reason: 'duplicate'
			});
			expect(posts).toHaveLength(1);
		}));

	test('a failed post after reservation is unknown and is never retried automatically', () =>
		withTempDir('qa-ledger-', async (dir) => {
			const ledger = new QaLedgerRepository(join(dir, 'ledger.jsonl'));
			const failing = {
				...ports([]),
				post: async () => {
					throw new Error('boom');
				}
			};
			const service = new QaThreadService(eligibility(good), ledger, failing, {
				stagingUrl: 'https://s.test',
				stagingBranch: 'staging'
			});
			expect(await service.handleLabel({ eventId: 'e1', issue: 5 })).toEqual({
				status: 'unknown',
				reason: 'post-failed-after-reservation'
			});
			expect(await service.handleLabel({ eventId: 'e1', issue: 5 })).toEqual({
				status: 'skipped',
				reason: 'duplicate'
			});
			expect(await ledger.unresolved()).toEqual([5]);
		}));
});

describe('QA thread text', () => {
	test('titles carry no emoji and steps carry Expected lines', () => {
		const task = {
			issue: 5,
			title: 'Logo <b>',
			issueUrl: 'https://github.com/o/r/issues/5',
			fixPr: 9,
			fixPrUrl: 'https://github.com/o/r/pull/9',
			mergeSha: 'a',
			instructions: '',
			instructionsSource: 'retest-comment' as const
		};
		const parent = qaParentText(task, 'https://s.test', 'staging');
		expect(parent.split('\n')[0]).toBe('*Staging QA · #5 Logo &lt;b&gt;*');
		expect(parent).not.toMatch(/\p{Extended_Pictographic}/u);
		expect(qaStepsText([{ action: 'A', expected: 'B' }])).toBe('1. A\n    Expected: B');
	});

	test('rejects malformed model output', () => {
		expect(parseQaSteps('no json')).toEqual([]);
		expect(parseQaSteps('[{"action":"a"}]')).toEqual([]);
		expect(parseQaSteps('Here: [{"action":"a","expected":"b"}]')).toHaveLength(1);
	});
});
