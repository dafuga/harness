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

export const configStrings = {
	defaultSort: 'newest',
	archivePath: 'orders/'.repeat(35),
	fulfilmentNote:
		'Review the order checklist before packing, confirm every delivery address, and attach the shipping label.\nKeep <orders> & details together so the delivery team can match each parcel with its instructions and contact the customer before dispatch.'
} as const;

export const longConfigValue = JSON.stringify(configStrings.archivePath);
export const configRemoteExpression =
	'process.env.REPORT_ORIGIN ?? "https://orders.example.test/integrations"';
export const configExpressions = {
	remoteEndpoint: configRemoteExpression,
	designProperties:
		'/^(?:color|background(?:-.+)?|border(?:-.+)?|outline(?:-.+)?|fill|stroke|opacity|box-shadow|filter|backdrop-filter|<orders>)$/',
	message: '(() => {\n  throw new Error("Config expressions must never execute <orders>");\n})()',
	retryDelay: '10 * 1000'
};

/** Source-derived settings vary with the selected revision, independently of contract examples. */
export function configSnapshot(unit: HarnessUnit, commit: string): HarnessUnit {
	if (unit.kind !== 'config') return unit;
	const values = {
		pageSize: commit === commits.first ? '10' : '25',
		'build.cssCodeSplit': 'true',
		defaultSort: JSON.stringify(configStrings.defaultSort),
		enabled: 'false',
		emptyLabel: '""',
		retryCount: '0',
		fallback: 'null',
		regions: '["ca", "us"]',
		schema: configExpression(commit),
		archivePath: longConfigValue,
		fulfilmentNote: JSON.stringify(configStrings.fulfilmentNote),
		...configExpressions,
		steps: '[{label: "Pack", flags: [true, false]}, "Ship"]',
		emptySteps: '[]'
	};
	return Object.assign({}, unit, {
		configValues: Object.entries(values).map(([name, value]) => ({
			name: `orderSettings.${name}`,
			value,
			...(['schema', 'steps', ...Object.keys(configExpressions)].includes(name)
				? {}
				: { literal: JSON.parse(value) }),
			source: unit.owns.source[0],
			...structuredFixture(name, value)
		}))
	});
}

/** Static nodes model committed expressions; the browser never evaluates config code. */
const expression = (source: string) => ({ kind: 'expression' as const, source });
const array = (source: string, nodes: ReturnType<typeof expression>[]) => ({
	kind: 'array' as const,
	source,
	count: nodes.length,
	entries: nodes.map((node, index) => ({ name: String(index), node }))
});

function schemaStructure(source: string) {
	const fields = {
		title: 'z.string()',
		terms: 'z.string()',
		pageSize: /z.literal\((10|25)\)/.exec(source)![0],
		label: 'z.literal("<orders> & details")',
		folders: 'z.string()'
	};
	return {
		kind: 'object' as const,
		source,
		count: 5,
		entries: Object.entries(fields).map(([name, value]) => ({ name, node: expression(value) }))
	};
}

function structuredFixture(name: string, source: string) {
	if (name === 'regions')
		return { structure: array(source, [expression('"ca"'), expression('"us"')]) };
	if (name === 'emptySteps') return { structure: array(source, []) };
	if (name === 'schema') return { structure: schemaStructure(source) };
	if (name !== 'steps') return {};
	return {
		structure: {
			kind: 'array' as const,
			source,
			count: 2,
			entries: [
				{
					name: '0',
					node: {
						kind: 'object' as const,
						source: '{label: "Pack", flags: [true, false]}',
						count: 2,
						entries: [
							{ name: 'label', node: expression('"Pack"') },
							{
								name: 'flags',
								node: array('[true, false]', [expression('true'), expression('false')])
							}
						]
					}
				},
				{ name: '1', node: expression('"Ship"') }
			]
		}
	};
}

/** The grouped collection uses the same declared settings fixture with a separate responsibility. */
export function deliveryConfig(settings: HarnessUnit): HarnessUnit {
	return {
		...settings,
		id: 'app.config.delivery-settings',
		title: 'deliverySettings',
		owns: { source: ['src/configs/orders/deliverySettings.ts'], symbols: ['deliverySettings'] },
		configValues: [
			{
				name: 'deliverySettings.enabled',
				value: 'true',
				source: 'src/configs/orders/deliverySettings.ts',
				literal: true
			}
		]
	};
}
