import { expect } from 'vitest';
import {
	identitySandbox,
	makeTaskInput,
	runnerFor
} from '../adapters/agents-providers/module-task-runner.test.fixtures';
import type {
	TaskRunResult,
	TaskSelection
} from '../../src/repositories/agents-providers/ModuleTaskRepository.types';

/** The shared run-method case covers scoped inputs with absent, conflicting and exact identities. */
export async function assertTaskModelIdentity(): Promise<void> {
	const outcomes = [];
	const expected = [];
	for (const provider of ['claude', 'codex'] as const) {
		const model = provider === 'claude' ? 'claude-haiku-5-5' : 'gpt-6-luna';
		for (const reported of [undefined, 'different-model', model]) {
			outcomes.push(await observedIdentity({ provider, model, intelligence: 'max' }, reported));
			expected.push(
				reported === model
					? { status: 'accepted', reportedModel: model, inputTokens: 7 }
					: {
							status: 'rejected',
							reportedModel: reported ?? null,
							identityError: true,
							inputTokens: 7
						}
			);
		}
	}
	expect(outcomes, 'Worker completions require an exact reported model and preserve usage').toEqual(
		expected
	);
}

async function observedIdentity(selection: TaskSelection, model: string | undefined) {
	const usage = {
		input_tokens: 7,
		output_tokens: 2,
		cache_read_input_tokens: 0,
		cache_creation_input_tokens: 0
	};
	const events =
		selection.provider === 'claude'
			? [
					{ type: 'system', subtype: 'init', model },
					{ type: 'result', is_error: false, result: 'Done', usage }
				]
			: [{ type: 'turn.completed', model, usage }];
	const runner = runnerFor(
		async () => ({
			code: 0,
			stdout: events.map((event) => JSON.stringify(event)).join('\n')
		}),
		identitySandbox
	);
	try {
		const result = await runner.run(
			makeTaskInput(selection.provider, selection.model, selection.intelligence)
		);
		return {
			status: 'accepted',
			reportedModel: result.reportedModel,
			inputTokens: result.usage?.inputTokens
		};
	} catch (error) {
		const failure = error as Error & Pick<TaskRunResult, 'reportedModel' | 'usage'>;
		return {
			status: 'rejected',
			reportedModel: failure.reportedModel,
			identityError: /different model|did not report its model/.test(failure.message),
			inputTokens: failure.usage?.inputTokens
		};
	}
}
