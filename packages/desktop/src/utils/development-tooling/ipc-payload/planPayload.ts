import { z } from 'zod';
import type { PlanDraft } from '../../../models/development-tooling/DesktopBridge.types';
import { categories } from '../../../models/development-tooling/Desktop.types';
import { enumField, textField } from '../ipcFields';

const text = z
	.string()
	.min(1)
	.max(160)
	.refine((entry) => entry.trim().length > 0);
const field = z.strictObject({
	name: text,
	type: text,
	description: z.string().max(2000).optional()
});
const proposed = z.strictObject({
	inputs: z.array(field).max(24),
	outputs: z.array(field).max(24),
	errors: z
		.array(text)
		.max(24)
		.refine((errors) => new Set(errors).size === errors.length)
});

/** Keep the authored contract; states and viewports belong to the planning API. */
export function planPayload(input: Record<string, unknown>): PlanDraft {
	return {
		category: enumField(input.category, categories),
		title: textField(input.title, 160),
		goal: textField(input.goal, 6000),
		...(input.contract === undefined ? {} : { contract: proposed.parse(input.contract) })
	};
}
