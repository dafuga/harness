// @harness-uid u_2e5xbm5hg2
import { fail } from '../../core/development-tooling/errors';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { runLoopEvaluatorProcess } from '../execution-runtimes/runLoopEvaluatorProcess';
import type { AgentEvaluation } from './evaluateAgent.types';

export type { AgentEvaluation, AgentEvaluator } from './evaluateAgent.types';

/** Run an authenticated read-only evaluator on supplied evidence and admit only its typed result. */
export async function evaluateAgent<Schema extends z.ZodType>(
	input: AgentEvaluation<Schema>
): Promise<z.output<Schema>> {
	const directory = await mkdtemp(join(tmpdir(), 'harness-evaluator-'));
	try {
		const schema = join(directory, 'schema.json');
		const verdict = join(directory, 'verdict.json');
		await writeFile(schema, JSON.stringify(z.toJSONSchema(input.schema)));
		const result = await runLoopEvaluatorProcess(
			directory,
			evaluatorCommand(input.model, schema, verdict),
			{
				input: input.prompt,
				timeoutMs: 180_000,
				maxBuffer: 2_000_000
			}
		);
		if (result.code !== 0) fail('The semantic evaluator exited unsuccessfully.');
		return input.schema.parse(JSON.parse(await readFile(verdict, 'utf8')));
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

function evaluatorCommand(model: string, schema: string, verdict: string) {
	return [
		'codex',
		'exec',
		'--ephemeral',
		'--ignore-user-config',
		'--ignore-rules',
		'--skip-git-repo-check',
		'--sandbox',
		'read-only',
		'-m',
		model,
		'-c',
		'approval_policy="never"',
		'-c',
		'model_provider="openai"',
		'-c',
		'model_reasoning_effort="medium"',
		'--output-schema',
		schema,
		'--output-last-message',
		verdict,
		'-'
	];
}
