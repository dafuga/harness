import { LevelValidator } from './LevelValidator';
import type { RecordValue } from './gameDocument.types';
import type { GameDocument } from '../../models/game-authoring/Game.types';
const safe = (v: unknown): v is string =>
	typeof v === 'string' &&
	v.length > 0 &&
	v.length <= 200 &&
	!['__proto__', 'constructor', 'prototype'].includes(v);
const scalar = (v: unknown) =>
	typeof v === 'boolean' ||
	(typeof v === 'string' && v.length <= 4000) ||
	(typeof v === 'number' && Number.isFinite(v));
const list = (v: unknown): v is unknown[] => Array.isArray(v) && v.length <= 200;
const record = (v: unknown): v is RecordValue =>
	Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown) => typeof v === 'string' && v.length <= 4000;
const validList = (v: unknown) => list(v) && v.every(safe);

export function validateDocument(input: unknown): string[] {
	if (
		!record(input) ||
		input.version !== 1 ||
		!list(input.views) ||
		!input.views.length ||
		!list(input.mechanics)
	)
		return ['Invalid game document'];
	const errors: string[] = [];
	const views = input.views.filter(record);
	if (views.length !== input.views.length) return ['Invalid game view'];
	unique(views, errors);
	for (const view of views) validateView(view, views, errors);
	for (const m of input.mechanics) if (!validMechanic(m)) errors.push('Invalid mechanic');
	unique(input.mechanics.filter(record), errors);
	return errors;
}
function validMechanic(m: unknown): boolean {
	return (
		record(m) &&
		safe(m.id) &&
		safe(m.title) &&
		text(m.description) &&
		validList(m.inputs) &&
		validList(m.events)
	);
}
function unique(items: RecordValue[], errors: string[]): void {
	const ids = new Set<unknown>();
	for (const item of items) {
		if (!safe(item.id) || ids.has(item.id))
			errors.push('Invalid or duplicate id: ' + String(item.id));
		ids.add(item.id);
	}
}
function validateView(view: RecordValue, views: RecordValue[], errors: string[]) {
	if (
		!safe(view.title) ||
		!['2d', '3d'].includes(String(view.dimension)) ||
		!text(view.style) ||
		!list(view.checkpoints)
	) {
		errors.push('Invalid game view');
		return;
	}
	validateLevel(view, errors);
	const nodes = view.checkpoints.filter(record);
	if (nodes.length !== view.checkpoints.length) errors.push('Invalid checkpoint');
	unique(nodes, errors);
	for (const node of nodes) validateNode(node, nodes, views, errors);
	if (cyclic(nodes)) errors.push('Cyclic checkpoint prerequisites');
}
function validNode(node: RecordValue): boolean {
	return (
		safe(node.title) &&
		validVisual(node) &&
		text(node.description) &&
		Number.isFinite(node.x) &&
		Number.isFinite(node.y) &&
		list(node.requires) &&
		list(node.conditions) &&
		list(node.actions) &&
		validRepeat(node.repeatable)
	);
}
function validRepeat(value: unknown): boolean {
	return value === undefined || typeof value === 'boolean';
}
function validateNode(
	node: RecordValue,
	nodes: RecordValue[],
	views: RecordValue[],
	errors: string[]
) {
	if (!validNode(node)) {
		errors.push('Invalid checkpoint');
		return;
	}
	for (const id of node.requires as unknown[]) {
		if (!safe(id) || !nodes.some((n) => n.id === id))
			errors.push('Unknown checkpoint: ' + String(id));
		if (id === node.id) errors.push('Checkpoint requires itself');
	}
	for (const c of node.conditions as unknown[])
		if (!validCondition(c)) errors.push('Invalid condition');
	for (const action of node.actions as unknown[]) validateAction(action, views, errors);
}
function validCondition(c: unknown): boolean {
	return (
		record(c) && safe(c.field) && ['eq', 'gte', 'lte'].includes(String(c.op)) && scalar(c.value)
	);
}
function validateAction(a: unknown, views: RecordValue[], errors: string[]): void {
	if (
		!record(a) ||
		!safe(a.target) ||
		!['set', 'emit', 'transition', 'visibility'].includes(String(a.type)) ||
		!scalar(a.value)
	) {
		errors.push('Invalid action');
		return;
	}
	if (a.type === 'transition' && !views.some((v) => v.id === a.target))
		errors.push('Unknown view: ' + a.target);
	if (a.type === 'visibility' && typeof a.value !== 'boolean')
		errors.push('Visibility must be boolean');
}
export function assertDocument(input: unknown): asserts input is GameDocument {
	const errors = validateDocument(input);
	if (errors.length) throw new Error(errors.join('; '));
}

function cyclic(nodes: RecordValue[]): boolean {
	const visits = new Set<unknown>(),
		done = new Set<unknown>();
	const byId = new Map(nodes.map((node) => [node.id, node]));
	const visit = (id: unknown): boolean => {
		if (visits.has(id)) return true;
		if (done.has(id)) return false;
		visits.add(id);
		const requires = byId.get(id)?.requires;
		if (Array.isArray(requires) && requires.some(visit)) return true;
		visits.delete(id);
		done.add(id);
		return false;
	};
	return nodes.some((node) => visit(node.id));
}

function validImage(value: unknown): boolean {
	if (value === undefined) return true;
	return (
		record(value) &&
		value.model === 'gpt-image-2' &&
		typeof value.path === 'string' &&
		/^static\/game\/checkpoints\/[a-f0-9]{64}\.png$/.test(value.path) &&
		typeof value.prompt === 'string' &&
		value.prompt.length <= 20000 &&
		typeof value.createdAt === 'string' &&
		Number.isFinite(Date.parse(value.createdAt))
	);
}

function validVisual(node: RecordValue): boolean {
	return (node.imagePrompt === undefined || text(node.imagePrompt)) && validImage(node.image);
}

function validateLevel(view: RecordValue, errors: string[]) {
	if (view.planning !== undefined && !LevelValidator.planning(view.planning))
		errors.push('Invalid level planning');
	if (view.world !== undefined && !LevelValidator.layout(view.world))
		errors.push('Invalid level layout');
}
