import type { PlanContract, NormalizedRegion, PlanAuthor } from '../models/Planning.types';
import { fail, hash, planData } from './planData';

export const categories = {
	page: 'pages',
	shell: 'shells',
	component: 'components',
	function: 'functions',
	config: 'configs',
	service: 'services'
};

export function text(value: unknown): asserts value is string {
	if (typeof value !== 'string' || !value.trim() || value.length > 1000000)
		fail('invalid-input', 'Expected non-empty text');
}

export function slug(value: unknown): asserts value is string {
	if (
		typeof value !== 'string' ||
		!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) ||
		value.length > 64
	)
		fail('invalid-input', 'Invalid slug');
}

export function planValidate(unitId: string): string {
	text(unitId);
	const [category, name, extra] = unitId.split('.');
	slug(name);
	if (extra || !Object.hasOwn(categories, category)) fail('invalid-input', 'Invalid unit identity');
	return `src/${categories[category as keyof typeof categories]}/${name}`;
}

export function contractHash(contract: PlanContract): string {
	text(contract?.responsibility);
	for (const fields of [contract.inputs, contract.outputs]) {
		if (!Array.isArray(fields)) fail('invalid-input', 'Invalid contract fields');
		for (const field of fields) {
			text(field.name);
			text(field.type);
		}
	}
	for (const values of [contract.errors, contract.states, contract.viewports]) {
		if (!Array.isArray(values) || new Set(values).size !== values.length)
			fail('invalid-input', 'Invalid contract list');
		values.forEach(text);
	}
	if (contract.viewports.some((v) => !['desktop', 'tablet', 'mobile', 'diagram'].includes(v)))
		fail('invalid-input', 'Invalid viewport');
	return hash(planData(contract));
}

export function author(value: PlanAuthor): void {
	if (!value || !['person', 'agent'].includes(value.kind)) fail('invalid-input', 'Invalid author');
	text(value.name);
}

export function region(value: NormalizedRegion | null): NormalizedRegion | null {
	if (value === null) return null;
	if (!value || ![value.x, value.y, value.width, value.height].every(Number.isFinite))
		fail('invalid-region', 'Invalid rectangle');
	const { x, y, width, height } = value;
	if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1)
		fail('invalid-region', 'Rectangle is outside image');
	return Object.fromEntries(
		Object.entries({ x, y, width, height }).map(([key, n]) => [key, Math.round(n * 1e6) / 1e6])
	) as unknown as NormalizedRegion;
}

export function filename(value: string): void {
	if (!/^[a-z0-9][a-z0-9.-]*$/.test(value) || value.includes('..'))
		fail('unsafe-path', 'Invalid artifact filename');
}

export { version } from './plan-design/version';
