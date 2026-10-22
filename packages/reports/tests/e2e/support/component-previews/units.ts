interface PreviewUnit {
	id: string;
	title: string;
	kind: string;
	status: string;
	owns: { source: string[] };
	runtime: { entry: string };
}
const manifests = import.meta.glob<PreviewUnit>(
	'../../../../../../specification/units/*.component.*.json',
	{ eager: true, import: 'default' }
);
// The registered entry is the implementation; a forwarding file of the same unit draws the same.
export const previewUnits = Object.values(manifests)
	.filter((unit) => unit.kind === 'component' && unit.status === 'active')
	.map((unit) => ({
		id: unit.id,
		title: unit.title,
		source: [unit.runtime.entry, ...unit.owns.source].find((path) => path.endsWith('.svelte'))
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
export function previewComponent(source: string | undefined) {
	const component = source ? modules[source] : undefined;
	if (!component) throw new Error(`No Svelte component to preview at ${source ?? 'any owned path'}`);
	return component as import('svelte').Component<Record<string, unknown>>;
}
