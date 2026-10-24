import { z } from 'zod';
import { contractItemSchema, unitIdPattern } from '../../../core/development-tooling/unitTypes';
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
export const taskInputSchema = z.strictObject({
	id,
	title: text,
	feature: id,
	module: id,
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
	finishedAt: z.iso.datetime()
});
export const storedTaskSchema = taskInputSchema.omit({ module: true, feature: true }).extend({
	feature: featureSchema,
	module: z.strictObject({ id, goal: text, files: z.array(path).min(1) }),
	sourceCommit: commit,
	contractHash: z.string().regex(/^[a-f0-9]{64}$/),
	status: z.enum(['queued', 'running', 'review', 'failed']),
	createdAt: z.iso.datetime(),
	claim: z.strictObject({ worker: id, token: z.uuid(), startedAt: z.iso.datetime() }).optional(),
	result: result.optional(),
	attempts: z.array(result).default([])
});
export const queueSchema = z.strictObject({
	schemaVersion: z.literal(1),
	features: z.array(featureSchema).max(1000),
	tasks: z.array(storedTaskSchema).max(10000)
});
