import { z } from 'zod';
import type { BenchmarkDefinition } from '../../../../core/agents-providers/subagentBenchmarkTypes';

const text = z.string().trim().min(1);
const id = text.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const file = text.refine(
	(value) =>
		!value.startsWith('/') &&
		!value.includes('\\') &&
		value
			.split('/')
			.every(
				(part) => part !== '..' && part !== '.' && part !== '' && part.toLowerCase() !== '.git'
			)
);
const candidateSchema = z
	.strictObject({
		id,
		runner: z.enum(['codex', 'claude']),
		model: text,
		effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']),
		instructions: z.string().default(''),
		tools: z.enum(['default', 'files']).default('default')
	})
	.refine(
		(candidate) =>
			candidate.runner !== 'codex' || (candidate.tools === 'default' && candidate.effort !== 'max'),
		'Codex supports default tools and low/medium/high/xhigh effort.'
	);

export const benchmarkDefinitionSchema = z.strictObject({
	version: z.literal(1),
	name: id,
	project: text.default('.'),
	revision: text.default('HEAD'),
	task: text,
	contract: text,
	allowedFiles: z.array(file).min(1),
	checks: z.array(z.strictObject({ id, command: text })).min(1),
	setup: z.array(text).default([]),
	candidates: z.array(candidateSchema).min(1),
	budget: z
		.strictObject({
			repetitions: z.number().int().min(1).max(100).default(3),
			timeoutMs: z.number().int().min(100).max(86400000).default(900000),
			repairs: z.number().int().min(0).max(10).default(2)
		})
		.prefault({})
});

export class BenchmarkDefinitionValidator {
	validate(input: unknown): BenchmarkDefinition {
		const definition = benchmarkDefinitionSchema.parse(input);
		for (const values of [
			definition.allowedFiles,
			definition.checks.map((check) => check.id),
			definition.candidates.map((candidate) => candidate.id)
		]) {
			if (new Set(values).size !== values.length)
				throw new Error('Duplicate benchmark identifiers or paths.');
		}
		return definition;
	}
}
