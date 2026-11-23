import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const mountResult = { component: 'ProviderPicker' };
const mountMock = vi.fn(() => mountResult);

vi.mock('svelte', () => ({ mount: mountMock }));

test('Mounts the provider picker into the app container', async () => {
	const getElementById = vi.fn(() => null);
	vi.stubGlobal('document', { getElementById });
	try {
		const { providerPickerEntry } =
			await import('../../src/utils/agents-providers/providerPickerEntry');
		const mounted = providerPickerEntry();
		const output = { result: mounted, calls: mountMock.mock.calls.length };

		expect(mounted).toBe(mountResult);
		expect(getElementById).toHaveBeenCalledWith('app');
		recordExampleCases(
			{
				unitId: 'reports.function.provider-picker-entry',
				symbol: 'providerPickerEntry',
				state: 'mounts-the-provider-picker-into-the-app-container',
				evidence: 'examples-cases',
				file: 'mounts-the-provider-picker-into-the-app-container.json'
			},
			[
				{
					name: 'mount passes the app lookup result through to Svelte',
					input: { targetId: 'app', target: null },
					output
				}
			]
		);
	} finally {
		vi.unstubAllGlobals();
	}
});
