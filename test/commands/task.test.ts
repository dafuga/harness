import { expect, test } from 'vitest';
import { TaskCommand } from '../../src/commands/TaskCommand';
import { taskAuditRepo } from '../support/taskAuditRepo';

test('the task command shares the planning and coding completion gates', async () => {
	const repo = await taskAuditRepo();
	try {
		const command = new TaskCommand(repo.root);
		expect(
			(await command.run({ kind: 'planning', goal: 'Plan search', plan: 'plan.md' })).passed
		).toBe(true);
		expect((await command.run({ kind: 'coding', goal: 'Implement search' })).passed).toBe(false);
	} finally {
		await repo.dispose();
	}
});
