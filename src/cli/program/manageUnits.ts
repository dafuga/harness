import type { UnitsOptions, IndexReport, CheckReport } from './manageUnits.types';
import { fail } from '../../core/development-tooling/errors';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type { UnitIndexResult } from '../../workflows/development-tooling/load-units/unit-index-service/UnitIndexService';
import { UnitRegistryValidator } from '../../validators/development-tooling/UnitRegistryValidator';
import { previewBinding } from '../../utils/development-tooling/previewBinding';
import {
	graphOf,
	loadUnits,
	type LoadedUnits
} from '../../workflows/development-tooling/load-units/loadUnits';

/** Reconciles the registry with source; writes manifests only when asked. */
export async function indexUnits(options: UnitsOptions = {}): Promise<IndexReport> {
	const loaded = await loadUnits(options.root);
	const { manifests, ...changes } = loaded.fresh;
	const written = options.write ? await loaded.repository.write(manifests) : [];
	return {
		...changes,
		units: manifests.filter((manifest) => manifest.status === 'active').length,
		written,
		uncertain: graphOf(loaded, manifests).uncertain.length
	};
}

export async function checkUnits(options: UnitsOptions = {}): Promise<CheckReport> {
	const loaded = await loadUnits(options.root);
	return {
		units: loaded.stored.filter((manifest) => manifest.status === 'active').length,
		uncertain: graphOf(loaded).uncertain.length,
		errors: registryErrors(loaded)
	};
}

/** Every reason the stored registry cannot be trusted for impact and verification. */
export function registryErrors(loaded: LoadedUnits): string[] {
	const files = new Set(loaded.index.files.keys());
	const known = new Set(loaded.stored.map((manifest) => manifest.id));
	const scenarios = new Set(loaded.scenarios.map((scenario) => scenario.id));
	return [
		...loaded.errors,
		...loaded.stored
			.filter((unit) => unit.status === 'active')
			.flatMap((unit) => previewBinding(unit, loaded.scenarios)),
		...new UnitRegistryValidator().validate(loaded.stored, files),
		...loaded.scenarios.flatMap((scenario) =>
			scenario.units
				.filter((unit) => !known.has(unit))
				.map((unit) => `${scenario.id} covers unknown unit ${unit}`)
		),
		...loaded.stored.flatMap((unit) =>
			unit.scenarios
				.filter((scenario) => !scenarios.has(scenario))
				.map((scenario) => `${unit.id} names unknown scenario ${scenario}`)
		),
		...staleness(loaded.fresh, loaded.unformatted)
	];
}

function staleness(fresh: UnitIndexResult, unformatted: string[]): string[] {
	const changes = [
		...unformatted.map((id) => `rewrite ${id}`),
		...fresh.added.map((id) => `add ${id}`),
		...fresh.updated.map((id) => `update ${id}`),
		...fresh.moved.map((move) => `move ${move.id}`),
		...fresh.revived.map((id) => `revive ${id}`)
	];
	if (changes.length === 0) return [];
	const shown = changes.slice(0, 8).join(', ') + (changes.length > 8 ? ', ...' : '');
	return [`Registry is stale; run harness units index --write (${changes.length}: ${shown})`];
}

/** Retires a unit whose source is gone; its identity and baseline remain as a tombstone. */
export async function retireUnit(
	id: string,
	reason: string,
	options: UnitsOptions = {}
): Promise<ComponentManifest> {
	const loaded = await loadUnits(options.root);
	const unit = loaded.stored.find((manifest) => manifest.id === id);
	if (!unit) return fail(`Unknown unit "${id}".`);
	if (!reason.trim()) return fail('Retiring a unit requires --reason.');
	const remaining = unit.owns.source.filter((path) => loaded.index.files.has(path));
	if (remaining.length > 0) {
		return fail(`${id} still owns ${remaining.join(', ')}; remove or reassign its source first.`);
	}
	const now = options.now?.() ?? new Date().toISOString();
	const retired: ComponentManifest = { ...unit, status: 'retired', retired: { reason, at: now } };
	await loaded.repository.write([retired]);
	return retired;
}

export function renderIndex(report: IndexReport, wrote: boolean): string {
	const lines = [
		`Indexed ${report.units} units: ${report.added.length} added, ${report.updated.length} updated, ` +
			`${report.moved.length} moved, ${report.revived.length} revived.`,
		...report.moved.map((move) => `  move ${move.id}: ${move.from} -> ${move.to}`),
		...report.orphaned.map((id) => `  orphaned ${id}: retire it or restore its source`),
		`${report.uncertain} uncertain reference${report.uncertain === 1 ? '' : 's'}.`
	];
	const pending = report.added.length + report.updated.length + report.moved.length;
	if (!wrote && pending > 0) lines.push('Run again with --write to update specification/units.');
	return lines.join('\n');
}

export function renderCheck(report: CheckReport): string {
	const plural = report.uncertain === 1 ? '' : 's';
	return `Units registry is valid: ${report.units} units, ${report.uncertain} uncertain reference${plural}.`;
}

export type { UnitsOptions, IndexReport, CheckReport } from './manageUnits.types';
