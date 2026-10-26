import { z } from 'zod';
import { contractItemSchema, unitIdPattern } from '../../../core/development-tooling/unitTypes';
import { taskUsageSchema, taskExecutionSchema, taskReviewSchema } from './taskUsage';
const id = z.string().regex(unitIdPattern).max(150);
const text = z.string().trim().min(1).max(16000);
const commit = z.string().regex(/^[a-f0-9]{40}$/);
const path = z.string().regex(/^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[^\0\r\n]+$/);
const assignedFile = z
	.string()
	.min(1)
	.refine((value) => {
		const segments = value.split('/');
		return (
			!value.startsWith('/') &&
			!/^[a-zA-Z]:/.test(value) &&
			!value.includes('\\') &&
			!/[\u0000-\u001f\u007f-\u009f*?]/.test(value) &&
			segments.every(
				(segment) =>
					segment.length > 0 &&
					segment !== '.' &&
					segment !== '..' &&
					segment.toLowerCase() !== '.git'
			)
		);
	}, 'must be a canonical relative file path');
export const featureSchema = z.strictObject({ id, goal: text, tldr: text });
export const wantedContractSchema = z.strictObject({
	responsibility: text,
	inputs: z.array(contractItemSchema),
	outputs: z.array(contractItemSchema).min(1),
	errors: z.array(contractItemSchema)
});
export const taskInputSchema = z.strictObject({
	id,
	title: text,
	feature: id,
	module: id,
	dependsOn: z
		.array(id)
		.max(10000)
		.refine((dependencies) => new Set(dependencies).size === dependencies.length, {
			message: 'must not contain duplicate task dependencies'
		})
		.optional(),
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
	assignedFiles: z
		.array(assignedFile)
		.max(64)
		.superRefine((files, context) => {
			if (new Set(files).size !== files.length)
				context.addIssue({ code: 'custom', message: 'must not contain duplicate file paths' });
		})
		.optional(),
	role: z.enum(['implementation', 'verification']).default('implementation'),
	instructions: text,
	wantedContract: wantedContractSchema,
	model: z.string().trim().min(1).max(150).default('auto'),
	provider: z.enum(['claude', 'codex']).optional(),
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
	error: z.string().optional(),
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
	owner: z.strictObject({ workspace: z.uuid(), pid: z.number().int().positive(), startedAt: text })
});
export const storedTaskSchema = taskInputSchema.omit({ module: true, feature: true }).extend({
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
const planCommit = z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const planOptionSchema = z.strictObject({
	id,
	commit: planCommit,
	path: assignedFile,
	sha256: digest,
	preferred: z.boolean()
});
export const planPageSchema = z.strictObject({
	module: id,
	options: z.array(planOptionSchema).min(1).max(10),
	selected: id.optional()
});
export const planChangeSchema = z.strictObject({
	unit: id,
	parent: id.optional(),
	kind: z.enum(['add', 'modify', 'remove', 'reuse']),
	wantedContract: wantedContractSchema.optional(),
	assignedFiles: z.array(assignedFile).max(64)
});
export const planApprovalSchema = z.strictObject({
	digest,
	reviewer: text,
	approvedAt: z.iso.datetime()
});
export const planSchema = z.strictObject({
	feature: id,
	sourceCommit: planCommit,
	revision: z.number().int().positive(),
	goal: text,
	tldr: text,
	pages: z.array(planPageSchema).max(10000),
	changes: z.array(planChangeSchema).max(10000),
	tasks: z.array(taskInputSchema).max(10000),
	digest,
	approval: planApprovalSchema.optional()
});
export const queueSchema = z.strictObject({
	schemaVersion: z.literal(1),
	features: z.array(featureSchema).max(1000),
	tasks: z.array(storedTaskSchema).max(10000),
	plans: z.array(planSchema).max(10000).optional()
});
