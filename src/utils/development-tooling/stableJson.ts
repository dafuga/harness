import type { Position } from './stableJson.types';
const printWidth = 100;
const tabWidth = 2;

/** Serializes JSON in the project Prettier style so generated files pass format checks. */
export function stableJson(value: unknown): string {
	return `${render(value, { indent: 0, reserved: 0 })}\n`;
}

function render(value: unknown, position: Position): string {
	if (Array.isArray(value)) return renderArray(value, position);
	if (value && typeof value === 'object') return renderObject(value, position.indent);
	return JSON.stringify(value ?? null);
}

function renderArray(items: unknown[], position: Position): string {
	if (items.length === 0) return '[]';
	const flat = `[${items.map((item) => JSON.stringify(item ?? null)).join(', ')}]`;
	const width = position.indent * tabWidth + position.reserved + flat.length;
	if (items.every(isPrimitive) && width <= printWidth) return flat;
	const inner = position.indent + 1;
	const lines = items.map((item, index) => {
		const reserved = index < items.length - 1 ? 1 : 0;
		return `${tabs(inner)}${render(item, { indent: inner, reserved })}`;
	});
	return compactArray(`[\n${lines.join(',\n')}\n${tabs(position.indent)}]`, position);
}

/** Format the rendered snapshot without observing the original values again. */
function compactArray(rendered: string, position: Position): string {
	try {
		const inline = inlineContainers(JSON.parse(rendered));
		return inline !== undefined &&
			position.indent * tabWidth + position.reserved + inline.length <= printWidth
			? inline
			: rendered;
	} catch {
		return rendered;
	}
}

function inlineContainers(value: unknown): string | undefined {
	if (Array.isArray(value)) {
		const items = value.map(inlineContainers);
		return items.every((item) => item !== undefined) ? `[${items.join(', ')}]` : undefined;
	}
	if (value !== null && typeof value === 'object')
		return Object.keys(value).length === 0 ? '{}' : undefined;
	return JSON.stringify(value);
}

function renderObject(value: object, indent: number): string {
	const entries = Object.entries(value).filter(([, item]) => item !== undefined);
	if (entries.length === 0) return '{}';
	const inner = indent + 1;
	const lines = entries.map(([key, item], index) => {
		const label = `${JSON.stringify(key)}: `;
		const reserved = label.length + (index < entries.length - 1 ? 1 : 0);
		return `${tabs(inner)}${label}${render(item, { indent: inner, reserved })}`;
	});
	return `{\n${lines.join(',\n')}\n${tabs(indent)}}`;
}

function isPrimitive(value: unknown): boolean {
	return value === null || typeof value !== 'object';
}

function tabs(count: number): string {
	return '\t'.repeat(count);
}
