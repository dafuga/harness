import { image } from './shared';
import type { CatalogRow } from '../../../../src/utils/entityCatalog';

const attributes: Record<string, Record<string, unknown>> = {
	img: { src: image, alt: 'Example image', width: 180, height: 110 },
	a: { href: '#example' },
	button: { type: 'button' },
	select: { 'aria-label': 'Example choice' },
	textarea: { 'aria-label': 'Example text', placeholder: 'Write a message', rows: 3 },
	optgroup: { label: 'Example group' },
	option: { value: 'example' },
	details: { open: true },
	dialog: { open: true },
	progress: { value: 0.65, max: 1, 'aria-label': 'Example progress' },
	meter: { value: 0.65, max: 1, 'aria-label': 'Example meter' },
	canvas: { width: 180, height: 90 },
	embed: { width: 180, height: 90 },
	object: { width: 180, height: 90 },
	iframe: { width: 180, height: 90, title: 'Example frame', srcdoc: '<p>Embedded content</p>' },
	audio: { controls: true, src: '/media/preview.wav' },
	video: { controls: true, width: 180, height: 110 },
	svg: { width: 180, height: 80, viewBox: '0 0 180 80', 'aria-label': 'Example graphic' },
	path: { d: 'M12 60 45 15 78 60Z', stroke: 'currentColor', fill: 'none' },
	circle: { cx: 44, cy: 38, r: 26, fill: 'currentColor' },
	ellipse: { cx: 48, cy: 38, rx: 32, ry: 20, fill: 'currentColor' },
	rect: { x: 12, y: 15, width: 72, height: 44, rx: 4, fill: 'currentColor' },
	line: { x1: 12, y1: 60, x2: 84, y2: 15, stroke: 'currentColor' },
	polyline: { points: '12,60 45,15 78,60', stroke: 'currentColor', fill: 'none' },
	polygon: { points: '12,60 45,15 78,60', stroke: 'currentColor', fill: 'none' },
	text: { x: 12, y: 42, fill: 'currentColor' },
	tspan: { x: 12, y: 42, fill: 'currentColor' },
	textPath: { href: '#atom-path', fill: 'currentColor' },
	use: { href: '#atom-shape' },
	image: { href: image, width: 120, height: 72 },
	foreignObject: { width: 160, height: 72 }
};
const inputValues: Record<string, string | number> = {
	number: 42,
	range: 42,
	date: '2026-10-24',
	'datetime-local': '2026-10-24T12:30',
	time: '12:30',
	month: '2026-10',
	week: '2026-W43',
	color: '#f3c33b',
	email: 'example@example.test',
	url: 'https://example.test',
	button: 'Continue',
	submit: 'Continue',
	reset: 'Continue'
};

/** Representative native values, without network requests or project data. */
export function nativeAtomProps(tag: string, type?: string, variant = ''): Record<string, unknown> {
	const changed = nativeVariantProps(tag, variant);
	if (tag !== 'input') return { ...attributes[tag], ...changed };
	return {
		'aria-label': 'Example field',
		...(type ? {} : { type: 'text' }),
		...(type === 'checkbox' || type === 'radio' ? { checked: true } : {}),
		...(type === 'image'
			? { src: image, alt: 'Example image button', width: 180, height: 110 }
			: {}),
		...(type === 'file'
			? { accept: 'text/plain' }
			: { value: inputValues[type ?? 'text'] ?? 'Example' }),
		...changed
	};
}

/** Variants preserve native behavior rather than adding behavior to the atom. */
function nativeVariantProps(tag: string, variant: string): Record<string, unknown> {
	if (tag === 'pre' && variant === 'long')
		return { style: 'max-width:100%;overflow-x:auto', tabindex: 0 };
	const states: Record<string, Record<string, unknown>> = {
		disabled: {
			disabled: true,
			...(['input', 'textarea'].includes(tag) ? { value: 'Disabled example text' } : {}),
			...(['button', 'input', 'textarea'].includes(tag)
				? { style: 'opacity:var(--hx-opacity-disabled)' }
				: {})
		},
		empty: { value: '', placeholder: 'Example field' },
		filled:
			tag === 'path' ? { fill: 'currentColor' } : { value: 'A saved message with several words.' },
		closed: { open: false },
		unlinked: { href: undefined },
		'alt-only': { src: undefined, alt: 'No image available' },
		unavailable: { src: undefined },
		outlined: { fill: 'none', stroke: 'currentColor' }
	};
	return states[variant] ?? {};
}

export const nativeAtomFixture = (id: string) =>
	id.startsWith('reports.component.shared-primitives-atoms-') ? {} : undefined;

export function compositionRows(rows: CatalogRow[]): CatalogRow[] {
	return rows.map((row, index) => ({
		...row,
		entity: {
			...row.entity,
			unit: {
				...row.entity.unit,
				composition: { level: (['atom', 'molecule', 'organism'] as const)[index % 3] }
			}
		}
	}));
}
