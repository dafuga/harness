import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { HostedProjectService } from '../../src/services/development-tooling/desktop-bridge-service/HostedProjectService';
import type { Bridge } from '../../src/services/development-tooling/desktop-bridge-service/HostedProjectService.types';

function createHostedBridge(unavailable?: 'local' | 'hub') {
	const calls: unknown[] = [];
	const session = { projectId: 'local-project', busy: false, pending: 0 };
	const remote = {
		async listProjects() {
			if (unavailable === 'hub') throw Error('Hub is unavailable');
			return [{ id: 'shared-project', name: 'Shared example', kind: 'shared' as const }];
		},
		async snapshot(input: unknown) {
			calls.push({ method: 'snapshot', input });
			return { projectId: 'shared-project', kind: 'shared' };
		},
		async capabilities(projectId: string) {
			calls.push({ method: 'capabilities', projectId });
			return {
				comments: true,
				agents: false,
				planning: false,
				approval: false,
				source: 'github' as const
			};
		}
	};
	const local = {
		async listProjects() {
			if (unavailable === 'local') throw Error('Local registry is unavailable');
			return [{ id: 'local-project', name: 'Local example', kind: 'local' as const }];
		},
		async selectProject(input: { projectId: string }) {
			calls.push({ method: 'local-select', input });
			return { projectId: input.projectId };
		},
		async openProject() {
			return null;
		}
	} as unknown as Bridge;
	const service = new HostedProjectService(
		session as ConstructorParameters<typeof HostedProjectService>[0],
		remote as unknown as ConstructorParameters<typeof HostedProjectService>[1]
	);
	return { bridge: service.wrap(local), calls };
}

function createBusyBridge() {
	const session = { projectId: 'local-project', busy: true, pending: 0 };
	const local = {
		async listProjects() {
			return [];
		},
		async selectProject(input: { projectId: string }) {
			return input;
		},
		async openProject() {
			return null;
		}
	} as unknown as Bridge;
	const service = new HostedProjectService(
		session as ConstructorParameters<typeof HostedProjectService>[0],
		{} as ConstructorParameters<typeof HostedProjectService>[1]
	);
	return service.wrap(local);
}

test('Dispatches shared project selection and capabilities', async () => {
	const { bridge, calls } = createHostedBridge();
	const listed = await bridge.listProjects!();
	const snapshot = await bridge.selectProject!({ projectId: 'shared-project' });
	const capabilities = await bridge.capabilities!({ projectId: 'shared-project' });
	const onlyLocal = await createHostedBridge('hub').bridge.listProjects!();
	const onlyShared = await createHostedBridge('local').bridge.listProjects!();
	expect(onlyLocal).toEqual(listed.filter(({ kind }) => kind === 'local'));
	expect(onlyShared).toEqual(listed.filter(({ kind }) => kind === 'shared'));
	const output = { listed, snapshot, capabilities, calls };
	expect(output).toEqual({
		listed: [
			{ id: 'local-project', name: 'Local example', kind: 'local' },
			{ id: 'shared-project', name: 'Shared example', kind: 'shared' }
		],
		snapshot: { projectId: 'shared-project', kind: 'shared' },
		capabilities: {
			comments: true,
			agents: false,
			planning: false,
			approval: false,
			source: 'github'
		},
		calls: [
			{ method: 'snapshot', input: { projectId: 'shared-project', branch: null, commit: null } },
			{ method: 'capabilities', projectId: 'shared-project' }
		]
	});
	recordExampleCases(
		{
			unitId: 'desktop.service.hosted-project',
			symbol: 'wrap',
			state: 'dispatches-shared-project-selection-and-capabilities',
			evidence: 'examples-cases',
			file: 'dispatches-shared-project-selection-and-capabilities.json'
		},
		[
			{
				name: 'Lists local and shared projects, selects a shared project, and dispatches capabilities',
				input: { projectId: 'shared-project', operation: 'capabilities' },
				output
			}
		]
	);
});

test('Throws Error when selecting a project during an active operation', async () => {
	const bridge = createBusyBridge();
	await expect(bridge.selectProject!({ projectId: 'shared-project' })).rejects.toThrow(
		'Wait for the active project operation.'
	);
	const cases = [
		{
			name: 'Rejects shared project selection while the session is busy',
			input: { projectId: 'shared-project', busy: true },
			error: { name: 'Error', message: 'Wait for the active project operation.' }
		}
	];
	recordExampleCases(
		{
			unitId: 'desktop.service.hosted-project',
			symbol: 'selectProject',
			state: 'throws-error-when-selecting-a-project-during-an-active-opera',
			evidence: 'examples-cases',
			file: 'throws-error-when-selecting-a-project-during-an-active-opera.json'
		},
		cases
	);
});
