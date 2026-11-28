import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'vitest';
import { expect } from '../../verificationExpect';
import { ModuleTaskService } from '../../../src/services/agents-providers/ModuleTaskService';
import { ModuleTaskWorkerService } from '../../../src/services/agents-providers/ModuleTaskWorkerService';
import { moduleTaskFixture } from '../../support/moduleTaskFixture';
import { verifiedSubmission, verifiedTaskBaseline } from '../../support/moduleTaskEvidence';
import { runHarness } from '../../support/cli';
import { verifyHarnessModuleProgress } from '../../support/harnessModuleProgressFixture';

async function submitted() {
	const f = await moduleTaskFixture();
	await verifiedTaskBaseline(f);
	const service = new ModuleTaskService(f.root);
	await service.feature({ id: 'checkout', goal: 'Reliable checkout', tldr: 'Validated orders.' });
	await service.add(JSON.parse(await readFile(await f.input(), 'utf8')));
	await new ModuleTaskWorkerService(f.root, {
		run: async (input) => {
			await writeFile(join(input.cwd, 'src/orders.ts'), 'export const orders = 2;\n');
			const { provider, model, intelligence } = input;
			return { provider, model, intelligence, text: 'Done', reportedModel: model };
		}
	}).once('owner');
	const task = (await service.show('orders-validation')).task;
	const accept = (evidence?: string) =>
		service.review(task.id, {
			attempt: task.claim!.token,
			verdict: 'accepted',
			reviewer: 'tester',
			evidence
		});
	return { f, service, task, accept };
}

test('acceptance refuses a submission without a passing record of a commit that carries it', async () => {
	const { f, service, task, accept } = await submitted();
	const checkpoint = task.result!.checkpointCommit!;
	try {
		await expect(accept()).rejects.toThrow('Accepted review requires --evidence');
		await expect(accept('no-such-revision')).rejects.toThrow('is not a commit');
		await expect(accept(task.sourceCommit)).rejects.toThrow(
			'does not carry the submitted src/orders.ts unchanged'
		);
		await expect(accept(checkpoint)).rejects.toThrow('No verification record exists');
		const env = { HARNESS_ANALYTICS_DISABLED: '1' };
		const unexplained = await runHarness(
			['verify', 'run', '--commit', checkpoint],
			f.root,
			false,
			env
		);
		expect(unexplained.exitCode).toBe(1);
		await expect(accept(checkpoint)).rejects.toThrow(/proves service\.orders: .*without a reason/);
		expect((await service.show(task.id)).task).toMatchObject({ status: 'review', reviews: [] });
	} finally {
		await f.dispose();
	}
}, 60000);

test('a verified submission is accepted once and a resent verdict replays the recorded one', async () => {
	const { f, service, task, accept } = await submitted();
	try {
		const evidence = await verifiedSubmission(f, {
			sourceCommit: task.sourceCommit,
			result: { checkpointCommit: task.result!.checkpointCommit! }
		});
		expect(evidence.status).toBe('passed');
		const first = await accept(evidence.commit);
		expect(first).toMatchObject({ replayed: false, task: { status: 'accepted' } });
		const stored = (await service.show(task.id)).task;
		expect(stored.reviews).toEqual([
			expect.objectContaining({
				verdict: 'accepted',
				evidence: { commit: evidence.commit, record: evidence.id, scope: 'full', checks: 0 }
			})
		]);
		const again = await accept(evidence.commit);
		expect(again).toMatchObject({ replayed: true, commit: first.commit });
		expect((await service.show(task.id)).task.reviews).toHaveLength(1);
		await expect(
			service.review(task.id, {
				attempt: task.claim!.token,
				verdict: 'incomplete',
				feedback: 'Too late to bounce.'
			})
		).rejects.toThrow('already reviewed as accepted');
		await verifyHarnessModuleProgress(f, service, evidence);
	} finally {
		await f.dispose();
	}
}, 60000);
