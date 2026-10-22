import type { HarnessUnit } from '../src/models/Harness.types';
import { commits } from './entityUnits';

/** Source-derived settings vary with the selected revision, independently of contract examples. */
export function configSnapshot(unit: HarnessUnit, commit: string): HarnessUnit {
	if (unit.kind !== 'config') return unit;
	const values = {
		pageSize: commit === commits.first ? '10' : '25',
		defaultSort: '"newest"',
		enabled: 'false',
		emptyLabel: '""',
		retryCount: '0',
		fallback: 'null'
	};
	return Object.assign({}, unit, {
		configValues: Object.entries(values).map(([name, value]) => ({
			name: `orderSettings.${name}`,
			value,
			source: unit.owns.source[0]
		}))
	});
}
