import { test, vi } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { workspace, savedCopies, reconnection } from '../../scripts/ios-acceptance-workspace';
import type { Acceptance } from '../../scripts/ios-acceptance-run';

const stubs = vi.hoisted(() => ({
	control: vi.fn(), restart: vi.fn(), openDesign: vi.fn(), topLayout: vi.fn(),
	scrolledLayout: vi.fn(), shot: vi.fn(), keychainGroups: vi.fn(() => [] as string[])
}));

vi.mock('../../scripts/ios-acceptance-run', () => ({
	computerName: 'Fixture computer', control: stubs.control, footerText: 'return footer();',
	openDesign: stubs.openDesign, panelText: 'return document.body.innerText;', restart: stubs.restart,
	shot: stubs.shot
}));
vi.mock('../../scripts/ios-acceptance-layout', () => ({ topLayout: stubs.topLayout, scrolledLayout: stubs.scrolledLayout }));
vi.mock('../../scripts/ios-acceptance-simulator', () => ({ keychainGroups: stubs.keychainGroups }));

function exampleRun() {
	let checks = 0;
	const record = { begin: () => undefined, check: () => { checks += 1; }, hide: () => undefined };
	const page = {
		until: vi.fn(async (_expression: string, words: string) => {
			if (words === 'ixture') return 'models Fixture model';
			if (words === 'Offline cached view') return 'Offline cached view · Computer offline';
			if (words === 'Read-only · saved') return 'Read-only · saved · Offline cached view · not checked with the server';
			if (words === 'Computer offline') return 'Computer offline';
			if (words === 'Connected to Fixture computer') return 'Connected to Fixture computer';
			if (words === 'offered') return 'offered';
			if (words === 'current: ') return 'current: Computer unlocked · awake';
			if (words === 'access was removed') return 'access was removed';
			if (words === 'Connect to computer') return 'Connect to computer Scan QR code';
			return words;
		}),
		evaluate: vi.fn(async (expression: string) => {
			if (expression.includes('location.pathname')) return '/harness/project-1/harness/branch/main/pages/design | none';
			if (expression.includes('Comment on image')) return 'disabled';
			if (expression.includes('querySelectorAll')) return 'Comment,Plan,Change';
			return 'ok';
		})
	};
	const run = { record, page, udid: 'simulator-example', controlOrigin: 'http://127.0.0.1:1',
		project: { id: 'project-1', name: 'Example project' }, output: '/tmp/ios-acceptance-example' };
	return { run: run as unknown as Acceptance, checks: () => checks };
}

function save(symbol: string, state: string, input: unknown, output: unknown) {
	recordExampleCases({ unitId: 'desktop.script.ios-acceptance-workspace', symbol, state,
		evidence: 'examples-cases', file: `${state}.json` }, [{ name: symbol, input, output }]);
}

test('checks the shared workspace and computer state', async () => {
	const { run, checks } = exampleRun();
	stubs.control.mockResolvedValue({ state: 'awake', locked: false, requests: [], devices: [] });
	stubs.openDesign.mockResolvedValue('loaded');
	await workspace(run);
	expect(checks()).toBeGreaterThan(0);
	save('workspace', 'checks-the-shared-workspace-and-computer-state',
		{ project: run.project, computer: 'Fixture computer' }, { design: 'loaded', checks: checks() });
});

test('reads saved design while the computer is away', async () => {
	const { run, checks } = exampleRun();
	stubs.control.mockResolvedValue({ state: 'offline', locked: null, requests: [], devices: [] });
	stubs.openDesign.mockResolvedValue('loaded');
	await savedCopies(run);
	expect(checks()).toBeGreaterThan(0);
	save('savedCopies', 'reads-saved-design-while-the-computer-is-away',
		{ project: run.project, status: 'offline' }, { design: 'loaded', checks: checks() });
});

test('reconnects and revokes workspace access', async () => {
	const { run, checks } = exampleRun();
	stubs.control.mockResolvedValue({ state: 'online', locked: false, requests: [], devices: [
		{ deviceId: 'phone', name: 'Phone', online: true }
	] });
	await reconnection(run);
	expect(checks()).toBeGreaterThan(0);
	save('reconnection', 'reconnects-and-revokes-workspace-access',
		{ project: run.project, simulator: run.udid }, { screenshots: 2, keychainGroups: 0 });
});
