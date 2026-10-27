import type {
	CompactReasonManifest,
	ReasonManifest,
	ReasonSide,
	Symbol
} from './requiredReasons.types';
import { createHash } from 'node:crypto';
import type { RequiredReason } from '../../../core/development-tooling/explanationTypes';
import { componentVersion } from '../componentVersion';
import { stableJson } from '../stableJson';

/** Units that exist at a revision: active and with at least one source file present. */
export function presentUnits(side: ReasonSide): Map<string, ReasonManifest> {
	const present = side.manifests.filter(
		(unit) =>
			unit.status === 'active' && unit.owns.source.some((path) => side.index.files.has(path))
	);
	return new Map(present.map((unit) => [unit.id, unit]));
}

/** Every change between two revisions that needs a reason, one entry per function or unit. */
export function requiredReasons(base: ReasonSide, head: ReasonSide): RequiredReason[] {
	const before = presentUnits(base);
	const after = presentUnits(head);
	const whole = (unit: ReasonManifest, side: ReasonSide) => sourceVersion(unit, side);
	const reasons: RequiredReason[] = [];
	for (const [id, unit] of after) {
		const previous = before.get(id);
		if (previous) reasons.push(...changedSymbols({ base, head }, previous, unit));
		else
			reasons.push({ unit: id, symbol: '*', change: 'added', from: null, to: whole(unit, head) });
	}
	for (const [id, unit] of before) {
		if (after.has(id)) continue;
		reasons.push({ unit: id, symbol: '*', change: 'removed', from: whole(unit, base), to: null });
	}
	return reasons.sort(
		(left, right) => compare(left.unit, right.unit) || compare(left.symbol, right.symbol)
	);
}

function symbols(unit: ReasonManifest, side: ReasonSide): Symbol[] {
	return unit.owns.source.flatMap((file) =>
		(side.index.files.get(file)?.blocks ?? []).map((block) => ({
			file,
			name: block.name,
			hash: block.hash
		}))
	);
}

/** A symbol with the same name and content is unchanged, wherever its file moved. */
function changedSymbols(
	sides: { base: ReasonSide; head: ReasonSide },
	previous: ReasonManifest,
	unit: ReasonManifest
): RequiredReason[] {
	const remaining = symbols(previous, sides.base);
	const take = (match: (item: Symbol) => boolean) => {
		const index = remaining.findIndex(match);
		return index === -1 ? undefined : remaining.splice(index, 1)[0];
	};
	const current = symbols(unit, sides.head).filter(
		(item) => !take((old) => old.name === item.name && old.hash === item.hash)
	);
	const reasons: RequiredReason[] = current.map((item) => {
		const old = take((candidate) => candidate.name === item.name);
		const base = { unit: unit.id, symbol: item.name, file: item.file, to: item.hash };
		return old
			? { ...base, change: 'modified', from: old.hash }
			: { ...base, change: 'added', from: null };
	});
	const removed: RequiredReason[] = remaining.map((item) => ({
		unit: unit.id,
		symbol: item.name,
		file: item.file,
		change: 'removed',
		from: item.hash,
		to: null
	}));
	const declared = [reasonDeclarationHash(previous), reasonDeclarationHash(unit)];
	if (reasons.length + removed.length > 0 || declared[0] === declared[1])
		return [...reasons, ...removed];
	return [
		{ unit: unit.id, symbol: '<manifest>', change: 'modified', from: declared[0], to: declared[1] }
	];
}

/** @pure Hashes the parts of a manifest a person declares, rather than derived index facts. */
export function reasonDeclarationHash(unit: ReasonManifest): string {
	if (isCompact(unit)) return unit.declarationHash;
	const declared = {
		kind: unit.kind,
		responsibility: unit.responsibilityOrigin === 'declared' ? unit.responsibility : null,
		contract: unit.contract.origin === 'declared' ? unit.contract : null,
		dependencies: unit.dependencies.filter((dependency) => dependency.origin === 'declared'),
		runtime: unit.runtime.kind,
		targets: unit.runtime.targets.map((target) =>
			target.kind === 'module' ? { kind: target.kind, handler: target.handler ?? null } : target
		),
		scenarios: unit.scenarios,
		budgets: unit.budgets,
		lineage: unit.lineage ?? null
	};
	return createHash('sha256').update(stableJson(declared)).digest('hex').slice(0, 16);
}

function sourceVersion(unit: ReasonManifest, side: ReasonSide): string {
	if (!isCompact(unit)) return componentVersion(unit, side.index.files).source;
	const owned = [...unit.owns.source].sort().flatMap((path) => {
		const hash = side.index.files.get(path)?.hash;
		return hash ? [{ path, hash }] : [];
	});
	return createHash('sha256')
		.update(owned.map((file) => `${file.path}\0${file.hash}\n`).join(''))
		.digest('hex');
}

function isCompact(unit: ReasonManifest): unit is CompactReasonManifest {
	return 'declarationHash' in unit && !('schemaVersion' in unit);
}

function compare(left: string, right: string): number {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}

export type { ReasonSide } from './requiredReasons.types';
