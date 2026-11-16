import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import type { ProjectTaskRequest } from '../../src/models/projects-sessions/ProjectTask.types';

const validTask = (): ProjectTaskRequest => ({
	intent: 'task',
	mode: 'change',
	projectId: 'project-example',
	category: 'components',
	provider: 'codex',
	model: 'gpt-example',
	effort: null,
	text: 'Update the project heading',
	branch: 'feature/project-heading',
	commit: 'a1b2c3d4',
	environment: 'dev',
	conversation: [{ author: 'user', text: 'Please update the heading.' }]
});

test('describes a project task tied to its revision', () => {
	const request = validTask();
	expect(request).toMatchObject({
		intent: 'task',
		mode: 'change',
		branch: 'feature/project-heading',
		commit: 'a1b2c3d4'
	});
	recordExampleCases(
		{
			unitId: 'desktop.model.project-task-types',
			symbol: 'ProjectTaskRequest',
			state: 'describes-a-project-task-tied-to-its-revision',
			evidence: 'examples-cases',
			file: 'describes-a-project-task-tied-to-its-revision.json'
		},
		[
			{
				name: 'valid change task for a pinned project revision',
				input: request,
				output: {
					intent: request.intent,
					mode: request.mode,
					branch: request.branch,
					commit: request.commit
				}
			}
		]
	);
});
