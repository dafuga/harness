import type { ApprovalCard } from '../../../src/core/execution-runtimes/scripted-deploy/approvalInbox.types';

export function approvalCardFixture(expiresAt: number): ApprovalCard {
	return {
		id: '2124a5ae-6b27-44c4-99b1-f7db5f482c01',
		plan: '1'.repeat(64),
		project: 'fixture',
		environment: 'preprod',
		action: 'deploy',
		target: 'preprod-fixture',
		source: 'a'.repeat(40),
		release: 'b'.repeat(64),
		artifact: 'c'.repeat(64),
		parity: 'd'.repeat(64),
		allowedDifferences: 0,
		smoke: 'scripts/smoke.sh',
		manifest: 'e'.repeat(64),
		predecessor: {
			id: 'cd94efa3-e937-47d5-9ad8-b763675aeca6',
			signoff: 'f'.repeat(64),
			smoke: ['route-health']
		},
		rollback: {
			target: 'preprod-fixture',
			version: 'previous-preprod',
			source: 'b'.repeat(40),
			artifact: '0'.repeat(64)
		},
		expiresAt
	};
}
