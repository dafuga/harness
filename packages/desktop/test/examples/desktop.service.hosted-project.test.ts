import { test } from 'vitest';
import { expect } from '../../../../test/verificationExpect';
import { recordExampleCases } from '../../../../test/support/recordExampleCases';
import { HostedProjectService } from '../../src/services/development-tooling/desktop-bridge-service/HostedProjectService';
import type { Bridge } from '../../src/services/development-tooling/desktop-bridge-service/HostedProjectService.types';

function createHostedBridge() {
	const calls: unknown[] = [];
	const session = { projectId: 'local-project', busy: false, pending: 0 };
	const remote = {
		async listProjects() {
			return [{ id: 'shared-project', name: 'Shared example', kind: 'shared' as const }];
		},
		async snapshot(input: unknown) {
			calls.push({ method: 'snapshot', input });
			return { projectId: 'shared-project', kind: 'shared' };
		},
		async capabilities(projectId: string) {
			calls.push({ method: 'capabilities', projectId });
			return { comments: true, agents: false, planning: false, approval: false, source: 'github' as const };
		}
	};
	const local = {
		async listProjects() {
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

test('Dispatches shared project selection and capabilities', async () => {
	const { bridge, calls } = createHostedBridge();
	const listed = await bridge.listProjects!();
	const snapshot = await bridge.selectProject!({ projectId: 'shared-project' });
	const capabilities = await bridge.capabilities!({ projectId: 'shared-project' });
	const output = { listed, snapshot, capabilities, calls };
	expect(output).toEqual({
		listed: [
			{ id: 'local-project', name: 'Local example', kind: 'local' },
			{ id: 'shared-project', name: 'Shared example', kind: 'shared' }
		],
		snapshot: { projectId: 'shared-project', kind: 'shared' },
		capabilities: { comments: true, agents: false, planning: false, approval: false, source: 'github' },
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
