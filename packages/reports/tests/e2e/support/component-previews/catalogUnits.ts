import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('../../../../../../specification/units/', import.meta.url));
export const catalogUnits = readdirSync(directory)
	.filter((name) => name.endsWith('.json'))
	.map(
		(name) =>
			JSON.parse(readFileSync(directory + name, 'utf8')) as {
				id: string;
				title: string;
				kind: string;
				status: string;
				owns: { source: string[] };
			}
	)
	.filter((unit) => ['component', 'shell'].includes(unit.kind) && unit.status === 'active')
	.sort((a, b) => a.id.localeCompare(b.id));
export const previewState = (id: string) => id.replaceAll('.', '-');
export const catalogViewports = [
	{ id: 'desktop', width: 920, height: 700 },
	{ id: 'tablet', width: 768, height: 900 },
	{ id: 'mobile', width: 390, height: 844 }
];

/** The normal capture test fails when a new active component lacks a declared preview state. */
export const catalogScenario = JSON.parse(
	readFileSync(
		new URL(
			'../../../../../../specification/scenarios/component-catalog-previews.json',
			import.meta.url
		),
		'utf8'
	)
) as { units: string[]; states: Array<{ id: string; units: string[] }> };
