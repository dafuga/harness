import { z } from 'zod';

export const moduleGroupsFile = 'harness.groups.json';
const id = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
	.refine((name) => name !== 'uncategorized');
export const moduleGroupConfig = z.strictObject({
	id,
	title: z.string().trim().min(1),
	terms: z.array(z.string().trim().min(1)).default([]),
	folders: z
		.array(
			z.string().regex(/^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[^\\]*src\/routes\/(?:[^\\]*\/)?$/)
		)
		.optional()
});

/** A project taxonomy is data: any distinct, named responsibility can become a group. */
export const moduleGroupsConfig = z
	.strictObject({
		schemaVersion: z.literal(1),
		groups: z.array(moduleGroupConfig),
		/** Exact supported entries retained during migration; never a blanket folder exclusion. */
		legacy: z.array(z.string().regex(/^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[^\\]+$/)).default([])
	})
	.superRefine((config, context) => {
		const ids = config.groups.map((group) => group.id);
		if (new Set(ids).size !== ids.length)
			context.addIssue({ code: 'custom', message: 'Category ids must be unique.' });
	});

export type { ModuleGroup, ModuleGroupsConfig } from './moduleGroupsConfig.types';
