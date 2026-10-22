import type { HarnessRevision, HarnessUnit } from '../src/models/Harness.types';
import { ids, units } from './entityUnits';

/** A relocation retains a supported forwarding entry beside the real category source. */
function categoryUnit(unit: HarnessUnit, commit: string): HarnessUnit {
	const group =
		unit.id === ids.search
			? { id: 'inputs', title: 'Inputs' }
			: { id: 'orders', title: commit === 'a'.repeat(40) ? 'Purchases' : 'Orders' };
	const source = unit.owns.source.map((path) =>
		path.includes('/routes/') || path.includes(`/${group.id}/`)
			? path
			: path.replace(/^(.*src\/[^/]+\/)/, `$1${group.id}/`)
	);
	return {
		...unit,
		group,
		owns: { ...unit.owns, source: [...new Set([...unit.owns.source, ...source])] },
		runtime: {
			...unit.runtime,
			targets: unit.runtime.targets.map((target) => ({ ...target, entry: source[0] }))
		}
	};
}

/** Every collection shares revision-bound groups and physical implementation addresses. */
export function categorySources(detail: HarnessRevision): HarnessRevision {
	const model = {
		...units[1],
		id: 'app.model.order',
		kind: 'model',
		title: 'Order',
		dependencies: [],
		owns: { source: ['src/models/orders/Order.ts'], symbols: ['Order'] }
	};
	return {
		...detail,
		registry: {
			...detail.registry,
			units: [
				...detail.registry.units,
				...(detail.registry.units.some((unit) => unit.id === model.id) ? [] : [model])
			].map((unit) =>
				categoryUnit(
					unit.id === ids.store && detail.commit !== 'a'.repeat(40)
						? { ...unit, dependencies: [...unit.dependencies, { unit: model.id, via: 'import' }] }
						: unit,
					detail.commit
				)
			)
		}
	};
}
