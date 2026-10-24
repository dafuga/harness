import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import { unitLineage } from '../../workflows/development-tooling/load-units/unit-index-service/unitLineage';
import { compositionFindings } from './atomicComposition';

/** Checks relationships between manifests that no single manifest can prove alone. */
export class UnitRegistryValidator {
	validate(manifests: ComponentManifest[], files: ReadonlySet<string>): string[] {
		const active = manifests.filter((manifest) => manifest.status === 'active');
		const known = new Set(active.map((manifest) => manifest.id));
		return [
			...compositionFindings(active),
			...active.flatMap((unit) => this.missingSource(unit, files)),
			...active.flatMap((unit) => this.helperExamples(unit)),
			...active.flatMap((unit) => this.helperSources(unit)),
			...active.flatMap((unit) => this.configControls(unit)),
			...active.flatMap((unit) => this.unknownDependencies(unit, known)),
			...this.sharedSource(active),
			...active.flatMap((unit) => this.lineage(unit, manifests))
		];
	}

	private configControls(unit: ComponentManifest): string[] {
		if (unit.kind !== 'config' || unit.catalog?.visibility === 'internal') return [];
		if (!unit.configControls?.length)
			return [`${unit.id} requires reviewed configControls with a source, audience and purpose`];
		const seen = new Set<string>();
		return unit.configControls.flatMap((control) => {
			const key = `${control.source}#${control.name}`;
			const issues: string[] = [];
			if (!unit.owns.source.includes(control.source))
				issues.push(`${unit.id}: ${control.name} names an unowned source`);
			if (seen.has(key)) issues.push(`${unit.id}: duplicate control ${control.name}`);
			seen.add(key);
			return issues;
		});
	}

	private helperSources(unit: ComponentManifest): string[] {
		return (unit.helperContracts ?? []).flatMap((helper) => {
			const prefix = `${unit.id}: ${helper.name}`;
			const issues: string[] = [];
			if (!/(?:^|\/)src\/helpers\/[^/]+\/[^/]+\.ts$/.test(helper.source))
				issues.push(`${prefix} must be implemented under src/helpers/<responsibility>/`);
			if (!unit.owns.source.includes(helper.source))
				issues.push(`${prefix} source must be owned by its registered module`);
			return issues;
		});
	}

	private helperExamples(unit: ComponentManifest): string[] {
		return (unit.helperContracts ?? []).flatMap((helper) => {
			const prefix = `${unit.id}: ${helper.name}`;
			if (!helper.examples?.length)
				return [
					`${prefix} requires at least one usage example with call, arguments and expected result`
				];
			const titles = new Set<string>(),
				calls = new Set<string>();
			return helper.examples.flatMap((example) => {
				const title = example.name.trim().replace(/\s+/g, ' ').toLowerCase();
				const call = example.call!.trim();
				const issues: string[] = [];
				if (/(?:^|:\s*)(?:example|case|demo|usage)(?:\s*#?\d+)?$/i.test(title))
					issues.push(
						`${prefix} usage examples require descriptive behavior titles: ${example.name}`
					);
				if (titles.has(title) || calls.has(call))
					issues.push(`${prefix} usage examples repeat a behavior title or call: ${example.name}`);
				titles.add(title);
				calls.add(call);
				return issues;
			});
		});
	}

	/** Lineage to retired identities must be recorded and must point at known units. */
	private lineage(unit: ComponentManifest, manifests: ComponentManifest[]): string[] {
		const recorded = unit.lineage?.predecessors ?? [];
		const known = new Set(manifests.map((manifest) => manifest.id));
		const expected = unitLineage({ id: unit.id, symbols: unit.owns.symbols }, manifests);
		return [
			...expected
				.filter((id) => !recorded.includes(id))
				.map((id) => `${unit.id} must record lineage to retired unit ${id}`),
			...recorded
				.filter((id) => !known.has(id))
				.map((id) => `${unit.id} names unknown predecessor ${id}`)
		];
	}

	private missingSource(unit: ComponentManifest, files: ReadonlySet<string>): string[] {
		return unit.owns.source
			.filter((path) => !files.has(path))
			.map((path) => `${unit.id} owns missing source ${path}`);
	}

	private unknownDependencies(unit: ComponentManifest, known: ReadonlySet<string>): string[] {
		return unit.dependencies
			.filter((dependency) => !known.has(dependency.unit))
			.map((dependency) => `${unit.id} depends on unknown unit ${dependency.unit}`);
	}

	private sharedSource(active: ComponentManifest[]): string[] {
		const owners = new Map<string, string[]>();
		for (const unit of active) {
			for (const path of unit.owns.source) owners.set(path, [...(owners.get(path) ?? []), unit.id]);
		}
		return [...owners.entries()]
			.filter(([, ids]) => ids.length > 1)
			.map(([path, ids]) => `${path} is owned by ${ids.join(' and ')}`);
	}
}
