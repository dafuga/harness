interface PreviewUnit {
	id: string;
	title: string;
	kind: string;
	status: string;
	owns: { source: string[] };
}
const manifests = import.meta.glob<PreviewUnit>(
	'../../../../../../specification/units/*.component.*.json',
	{ eager: true, import: 'default' }
);
export const previewUnits = Object.values(manifests)
	.filter((unit) => unit.kind === 'component' && unit.status === 'active')
	.map((unit) => ({
		id: unit.id,
		title: unit.title,
		source: unit.owns.source.find((path) => path.endsWith('.svelte'))!,
		sources: unit.owns.source
	}))
	.sort((a, b) => a.id.localeCompare(b.id));
const sources = [
	[
		'../../../../',
		'packages/reports/',
		import.meta.glob('../../../../src/components/**/*.svelte', { eager: true, import: 'default' })
	],
	[
		'../../../../../desktop/',
		'packages/desktop/',
		import.meta.glob('../../../../../desktop/src/components/**/*.svelte', {
			eager: true,
			import: 'default'
		})
	],
	[
		'../../../../../hub/',
		'packages/hub/',
		import.meta.glob('../../../../../hub/src/components/**/*.svelte', {
			eager: true,
			import: 'default'
		})
	]
] as const;
const modules = Object.fromEntries(
	sources.flatMap(([relative, root, entries]) =>
		Object.entries(entries).map(([path, component]) => [path.replace(relative, root), component])
	)
);
export function previewComponent(source: string) {
	const component = modules[source];
	if (!component) throw new Error(`No component import for ${source}`);
	return component as import('svelte').Component<Record<string, unknown>>;
}
