import type { PickerModel } from '../../src/core/pickerModelTypes';
import type { SwitchRequest, SwitchStore } from '../../src/core/pickerTypes';
import { switchRevision } from '../../src/core/pickerTypes';

export function createPickerFixture() {
	const records = new Map<string, SwitchRequest>();
	const store: SwitchStore = {
		get: (id) => records.get(id) ?? null,
		put: (record, expectedId) => {
			if (switchRevision(records.get(record.sessionId) ?? null) !== expectedId) return false;
			records.set(record.sessionId, JSON.parse(JSON.stringify(record)) as SwitchRequest);
			return true;
		},
		list: () => [...records.values()]
	};
	const target = { provider: 'harness-claude' as const, model: 'claude-opus-5-5', effort: 'xhigh' };
	const models: PickerModel[] = [
		{
			...target,
			label: 'Claude Opus 5.5',
			efforts: ['xhigh'],
			defaultEffort: 'xhigh',
			source: 'local-catalog'
		}
	];
	return { store, catalog: { list: async () => models }, target };
}
