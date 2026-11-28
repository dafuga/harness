// @harness-uid u_bya7wvvkm5
import { z } from 'zod';
import { contractItemSchema, unitIdPattern } from '../../../core/development-tooling/unitTypes';
import { taskUsageSchema, taskExecutionSchema, taskReviewSchema } from './taskUsage';
const id = z.string().regex(unitIdPattern).max(150);
const text = z.string().trim().min(1).max(16000);
const commit = z.string().regex(/^[a-f0-9]{40}$/);
const path = z.string().regex(/^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[^\0\r\n]+$/);
export const featureSchema = z.strictObject({ id, goal: text, tldr: text });
export const wantedContractSchema = z.strictObject({
	responsibility: text,
	inputs: z.array(contractItemSchema),
	outputs: z.array(contractItemSchema).min(1),
	errors: z.array(contractItemSchema)
});
export const taskPlatformSchema = z.enum(['linux', 'macos']);
const checkArg = z
	.string()
	.max(4000)
	.refine((arg) => !arg.includes('\0'));
const taskCheckSchema = z.strictObject({
	argv: z
		.tuple([checkArg.refine((program) => program.trim().length > 0)])
		.rest(checkArg)
		.refine((argv) => argv.length <= 32, 'Use at most 32 command arguments.'),
	timeoutMs: z.number().int().min(1).max(600_000).optional()
});
const checkRoundSchema = z.strictObject({
	status: z.enum(['passed', 'failed', 'timeout', 'cancelled', 'command-error']),
	exitCode: z.number().int().nullable(),
	durationMs: z.number().int().nonnegative()
});
export const taskInputSchema = z.strictObject({
	id,
	title: text,
	feature: id,
	module: id,
	moduleGoal: text.optional(),
	verificationFiles: z
		.array(
			path.refine(
				(p) => /(^|\/)(test|tests)\/|\.(test|spec)\.[jt]sx?$/.test(p),
				'must name an explicit test or verification fixture'
			)
		)
		.max(64)
		.optional(),
	instructions: text,
	check: taskCheckSchema.optional(),
	wantedContract: wantedContractSchema,
	requiredTools: z
		.array(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/))
		.max(16)
		.optional(),
	taskType: id.optional(),
	estimatedDifficulty: z.enum(['small', 'medium', 'large']).optional(),
	model: z.string().trim().min(1).max(150).default('auto'),
	provider: z.enum(['claude', 'codex']).optional(),
	platform: taskPlatformSchema.optional(),
	intelligence: z.enum(['low', 'medium', 'high', 'xhigh', 'max', 'ultra']).optional(),
	assignee: id.optional()
});
const result = z.strictObject({
	provider: z.enum(['claude', 'codex']),
	model: text,
	intelligence: text,
	reportedModel: z.string().nullable(),
	text: z.string(),
	worktree: z.string(),
	changedFiles: z.array(path),
	changedLines: z.number().int().nonnegative().optional(),
	error: z.string().optional(),
	failureCause: z.enum(['scope', 'workspace-error', 'check']).optional(),
	checkRounds: z.array(checkRoundSchema).max(3).optional(),
	fallback: z.boolean(),
	finishedAt: z.iso.datetime(),
	attempt: z.uuid().optional(),
	sourceCommit: commit.optional(),
	checkpointCommit: commit.optional(),
	usage: taskUsageSchema.optional(),
	executions: z.array(taskExecutionSchema).default([])
});
const claim = z.strictObject({
	worker: id,
	token: z.uuid(),
	startedAt: z.iso.datetime(),
	recoveredAt: z.iso.datetime().optional(),
	owner: z.strictObject({ workspace: z.uuid(), pid: z.number().int().positive(), startedAt: text })
});
export const storedTaskSchema = taskInputSchema.omit({ module: true, feature: true }).extend({
	/** Preserve newer dispatch metadata; older workers decline these tasks. */
	role: z.enum(['implementation', 'verification']).optional(),
	assignedFiles: z.array(path).optional(),
	dependsOn: z.array(id).optional(),
	feature: featureSchema,
	module: z.strictObject({ id, goal: text, files: z.array(path).min(1) }),
	sourceCommit: commit,
	contractHash: z.string().regex(/^[a-f0-9]{64}$/),
	status: z.enum(['queued', 'running', 'review', 'failed', 'accepted']),
	repairCommit: commit.optional(),
	reviews: z.array(taskReviewSchema).default([]),
	createdAt: z.iso.datetime(),
	claim: claim.optional(),
	claimHistory: z.array(claim).default([]),
	result: result.optional(),
	attempts: z.array(result).default([])
});
export const queueSchema = z.strictObject({
	schemaVersion: z.literal(1),
	features: z.array(featureSchema).max(1000),
	tasks: z.array(storedTaskSchema).max(10000)
});
