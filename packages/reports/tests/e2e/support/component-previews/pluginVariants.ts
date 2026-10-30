import type { ModuleEntry } from '../../../../../../src/services/module-system/moduleDefinition.types';
import type { PreviewCases } from './shared';

const prefix = 'reports.component.module-system-plugins-';
const statuses = [
	'available',
	'included',
	'available-testing',
	'installed-testing',
	'included-testing'
];
export const pluginVariants: Record<string, string[]> = {
	[`${prefix}explorer-plugin-card`]: [...statuses, 'empty-resources'],
	[`${prefix}plugin-state-pills`]: statuses,
	[`${prefix}plugin-resource-card`]: ['available', 'empty-instructions'],
	[`${prefix}plugin-steps`]: ['empty', 'long', 'multiline']
};

/** Keep installation, inclusion and testing flags independent in the public entry data. */
export function pluginVariant(id: string, props: PreviewCases[string], variant: string) {
	if (!id.startsWith(prefix)) return null;
	if (id === `${prefix}plugin-steps`) return steps(props, variant);
	const entry = props.entry as ModuleEntry;
	if (id === `${prefix}plugin-resource-card`)
		return variant === 'empty-instructions'
			? { ...props, resource: { ...entry.definition.resources[0], instructions: [] } }
			: { ...props, entry: status(entry, variant) };
	if (variant === 'empty-resources')
		return { ...props, entry: { ...entry, definition: { ...entry.definition, resources: [] } } };
	return { ...props, entry: status(entry, variant) };
}

function status(entry: ModuleEntry, variant: string): ModuleEntry {
	return {
		...entry,
		installed: !variant.startsWith('available'),
		definition: {
			...entry.definition,
			includedByDefault: variant.startsWith('included'),
			testing: variant.endsWith('-testing') ? { headless: true, script: 'test:unit' } : undefined
		}
	};
}

function steps(props: PreviewCases[string], variant: string) {
	const lines: Record<string, string[]> = {
		empty: [],
		long: ['Configure ' + 'SERVER_ONLY_ENVIRONMENT_'.repeat(25)],
		multiline: ['Create the template.\nThen run its tests.', 'Publish the reviewed template.']
	};
	return { ...props, lines: lines[variant] };
}
