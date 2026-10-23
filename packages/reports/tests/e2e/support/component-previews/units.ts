import { catalogVisual, type PreviewManifest } from './visualUnits';
import type { Component } from 'svelte';
const manifests = import.meta.glob<PreviewManifest>(
	[
		'../../../../../../specification/units/*.component.*.json',
		'../../../../../../specification/units/reports.page.*.json',
		'../../../../../../specification/units/reports.layout.*.json',
		'../../../../../../specification/units/desktop.page.*.json',
		'../../../../../../specification/units/hub.page.*.json',
		'../../../../../../specification/units/hub.layout.*.json'
	],
	{ eager: true, import: 'default' }
);
// The registered entry is the implementation; a forwarding file of the same unit draws the same.
export const previewUnits = Object.values(manifests)
	.filter(catalogVisual)
	.map((unit) => ({
		id: unit.id,
		title: unit.title,
		kind: unit.kind,
		source: [unit.runtime.entry, ...unit.owns.source].find((path) => path.endsWith('.svelte'))
	}))
	.sort((a, b) => a.id.localeCompare(b.id));
// The actual visual routes and layout; compatibility aliases remain services without a preview.
// Desktop's own pages draw too; its options-only layout renders nothing and is not read. The Hub
// pages draw, and so does its layout, which frames them and reads the session itself.
const sources = [
	[
		'../../../../',
		'packages/reports/',
		import.meta.glob(
			[
				'../../../../src/components/**/*.svelte',
				'../../../../src/routes/**/+page.svelte',
				'../../../../src/routes/+layout.svelte',
				'!../../../../src/routes/**/details/+page.svelte'
			],
			{ eager: true, import: 'default' }
		)
	],
	[
		'../../../../../desktop/',
		'packages/desktop/',
		import.meta.glob(
			[
				'../../../../../desktop/src/components/**/*.svelte',
				'../../../../../desktop/src/routes/**/+page.svelte'
			],
			{ eager: true, import: 'default' }
		)
	],
	[
		'../../../../../hub/',
		'packages/hub/',
		import.meta.glob(
			[
				'../../../../../hub/src/components/**/*.svelte',
				'../../../../../hub/src/routes/**/+page.svelte',
				'../../../../../hub/src/routes/+layout.svelte'
			],
			{ eager: true, import: 'default' }
		)
	]
] as const;
const modules = Object.fromEntries(
	sources.flatMap(([relative, root, entries]) =>
		Object.entries(entries).map(([path, component]) => [path.replace(relative, root), component])
	)
);
export function previewComponent(source: string | undefined) {
	const component = source ? modules[source] : undefined;
	if (!component)
		throw new Error(`No Svelte component to preview at ${source ?? 'any owned path'}`);
	return component as Component<Record<string, unknown>>;
}
