import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';

const mountConsole = vi.hoisted(() => vi.fn());

vi.mock('svelte', () => ({ mount: mountConsole }));
vi.mock('../../src/components/explorer-ui/HarnessShell.svelte', () => ({ default: {} }));

test('Mounts the console with host options or its default base', async () => {
	const app = {};
	const explicitOptions = { base: '/private-harness', links: [{ label: 'Runs', href: '/runs' }] };
	try {
		vi.stubGlobal('document', { getElementById: () => app });
		vi.stubGlobal('window', { harnessConsole: explicitOptions });
		vi.resetModules();
		await import('../../src/lib/development-tooling/console');
		expect(mountConsole).toHaveBeenCalledWith({}, { target: app, props: explicitOptions });
		const explicitCall = mountConsole.mock.calls.at(-1);

		vi.stubGlobal('window', {});
		vi.resetModules();
		await import('../../src/lib/development-tooling/console');
		expect(mountConsole).toHaveBeenLastCalledWith({}, { target: app, props: { base: '/harness' } });
		const defaultCall = mountConsole.mock.calls.at(-1);
		recordExampleCases(
			{
				unitId: 'reports.module.console',
				symbol: 'mount',
				state: 'mounts-the-console-with-host-options-or-its-default-base',
				evidence: 'examples-cases',
				file: 'mounts-the-console-with-host-options-or-its-default-base.json'
			},
			[
				{
					name: 'uses host supplied base and links',
					input: { base: '/private-harness', links: [{ label: 'Runs', href: '/runs' }] },
					output: { mounted: Boolean(explicitCall), props: explicitCall?.[1].props }
				},
				{
					name: 'falls back to the standard harness base',
					input: {},
					output: { mounted: Boolean(defaultCall), props: defaultCall?.[1].props }
				}
			]
		);
	} finally {
		vi.unstubAllGlobals();
	}
});
