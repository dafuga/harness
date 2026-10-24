import type { GameView, LevelLayout, LevelPlanning } from '../../models/game-authoring/Game.types';

/** Validates data-only geometry; model output never grants approval or executes code. */
export class LevelValidator {
	static layout(input: unknown): input is LevelLayout {
		if (!record(input) || !validFloor(input) || !record(input.spawn)) return false;
		if (
			!point(input.spawn, Number(input.width), Number(input.depth)) ||
			!Array.isArray(input.objects) ||
			input.objects.length > 80
		)
			return false;
		const ids = new Set<string>();
		for (const object of input.objects) {
			if (!validObject(object, Number(input.width), Number(input.depth)) || ids.has(object.id))
				return false;
			ids.add(object.id);
		}
		const spawn = input.spawn;
		return !input.objects.some((o) => o.kind === 'wall' && overlaps(spawn.x, spawn.z, o));
	}
	static planning(input: unknown): input is LevelPlanning {
		if (!record(input) || !text(input.concept) || !text(input.description)) return false;
		if (input.proposal !== undefined && !validProposal(input.proposal)) return false;
		return [input.approved, input.built].every((id) => id === undefined || hash(id));
	}
	static isCurrent(view: GameView): boolean {
		const p = view.planning,
			proposal = p?.proposal;
		return Boolean(
			p &&
			proposal &&
			proposal.concept === p.concept &&
			proposal.description === p.description &&
			proposal.dimension === view.dimension
		);
	}
	static isReady(view: GameView): boolean {
		if (!view.planning) return true;
		const p = view.planning;
		return (
			this.isCurrent(view) &&
			p.approved === p.proposal?.id &&
			p.built === p.proposal?.id &&
			JSON.stringify(view.world) === JSON.stringify(p.proposal?.layout)
		);
	}
}
function record(input: unknown): input is Record<string, unknown> {
	return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}
function text(input: unknown): input is string {
	return typeof input === 'string' && input.length <= 4000;
}
function hash(input: unknown): input is string {
	return typeof input === 'string' && /^[a-f0-9]{64}$/.test(input);
}
function extent(input: unknown): input is number {
	return typeof input === 'number' && Number.isFinite(input) && input >= 1 && input <= 40;
}
function coordinate(input: unknown, max: number): input is number {
	return (
		typeof input === 'number' && Number.isFinite(input) && input >= 0.25 && input <= max - 0.25
	);
}
function point(input: Record<string, unknown>, width: number, depth: number): boolean {
	return coordinate(input.x, width) && coordinate(input.z, depth);
}
function validObject(
	input: unknown,
	width: number,
	depth: number
): input is LevelLayout['objects'][number] {
	if (!record(input) || typeof input.id !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/.test(input.id))
		return false;
	if (!validIdentity(input) || !point(input, width, depth)) return false;
	if (!extent(input.width) || !extent(input.depth) || !extent(input.height)) return false;
	return fits(input, width, depth);
}
function fits(input: Record<string, unknown>, width: number, depth: number) {
	return (
		Number(input.x) - Number(input.width) / 2 >= 0 &&
		Number(input.x) + Number(input.width) / 2 <= width &&
		Number(input.z) - Number(input.depth) / 2 >= 0 &&
		Number(input.z) + Number(input.depth) / 2 <= depth
	);
}
function validProposal(input: unknown): boolean {
	return (
		record(input) &&
		hash(input.id) &&
		text(input.concept) &&
		text(input.description) &&
		['2d', '3d'].includes(String(input.dimension)) &&
		['codex', 'claude'].includes(String(input.provider)) &&
		validModel(input.model) &&
		text(input.summary) &&
		LevelValidator.layout(input.layout)
	);
}
function overlaps(x: unknown, z: unknown, object: LevelLayout['objects'][number]): boolean {
	return (
		Math.abs(Number(x) - object.x) < object.width / 2 + 0.2 &&
		Math.abs(Number(z) - object.z) < object.depth / 2 + 0.2
	);
}

function validFloor(input: Record<string, unknown>) {
	return extent(input.width) && extent(input.depth);
}
function validIdentity(input: Record<string, unknown>) {
	return (
		['wall', 'platform', 'prop', 'goal'].includes(String(input.kind)) &&
		text(input.label) &&
		Boolean(input.label.trim())
	);
}
function validModel(input: unknown) {
	return typeof input === 'string' && input.length > 0 && input.length <= 200;
}
