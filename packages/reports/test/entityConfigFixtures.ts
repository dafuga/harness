import type { HarnessUnit } from '../src/models/Harness.types';
import { commits } from './entityUnits';

/** Multiline source expressions are preserved verbatim, including markup-like string content. */
export const configExpression = (commit: string): string => `z.strictObject({
  title: z.string().trim().min(1),
  terms: z.array(z.string()).default([]),
  pageSize: z.literal(${commit === commits.first ? 10 : 25}),
  label: z.literal("<orders> & details"),
  folders: z.array(z.string().regex(/src\\/routes\\/orders\\//)).optional()
}).superRefine((settings, context) => {
  if (!settings.title) context.addIssue({ code: "custom", message: "Title required" });
})`;

export const longConfigValue = `"${'orders/'.repeat(35)}"`;

/** Source-derived settings vary with the selected revision, independently of contract examples. */
export function configSnapshot(unit: HarnessUnit, commit: string): HarnessUnit {
	if (unit.kind !== 'config') return unit;
	const values = {
		pageSize: commit === commits.first ? '10' : '25',
		defaultSort: '"newest"',
		enabled: 'false',
		emptyLabel: '""',
		retryCount: '0',
		fallback: 'null',
		regions: '["ca", "us"]',
		schema: configExpression(commit),
		archivePath: longConfigValue
	};
	return Object.assign({}, unit, {
		configValues: Object.entries(values).map(([name, value]) => ({
			name: `orderSettings.${name}`,
			value,
			...(['schema', 'archivePath'].includes(name) ? {} : { literal: JSON.parse(value) }),
			source: unit.owns.source[0]
		}))
	});
}
