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
	.filter((unit) => unit.kind === 'component' && unit.status === 'active')
	.sort((a, b) => a.id.localeCompare(b.id));
export const previewState = (id: string) => id.replaceAll('.', '-');
export const catalogViewports = [
	{ id: 'desktop', width: 920, height: 700 },
	{ id: 'tablet', width: 768, height: 900 },
	{ id: 'mobile', width: 390, height: 844 }
];
