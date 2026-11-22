import { assertSnapshotCaptureEnvironment } from '../support/snapshotCaptureEnvironment';
import { measureWorkload } from '../support/measureWorkload';
import { withTempRepo } from '../support/temporary';
import { afterEach, expect, test, vi } from 'vitest';
import { SnapshotAdapter } from '../../src/adapters/verification-evidence/snapshot-adapter/SnapshotAdapter';
import {
	defaultVerifyConfig,
	type VerifyConfig
} from '../../src/core/verification-evidence/verifyTypes';
import { BuildIdentityService } from '../../src/services/verification-evidence/BuildIdentityService';
import {
	CheckRunService,
	type CheckOutcome
} from '../../src/workflows/verification-evidence/run-verify/verification-service/check-run-service/CheckRunService';
import { SnapshotRunService } from '../../src/workflows/verification-evidence/run-verify/verification-service/SnapshotRunService';
import * as resourceAdmission from '../../src/utils/execution-runtimes/resourceWork';

afterEach(() => vi.restoreAllMocks());

/** Two builds: one setup step names none, and each other names the build it produces. */
const config: VerifyConfig = {
	...defaultVerifyConfig,
	setup: [
		{ command: 'install' },
		{ command: 'build web', builds: ['web'] },
		{ command: 'build docs', builds: ['docs'] }
	],
	builds: [
		{ id: 'web', directory: 'web/dist' },
		{ id: 'docs', directory: 'docs/dist' }
	]
};
/** Nothing is exported, linked or drifting, so the run goes straight to setup and the builds. */
const snapshot = {
	directory: '/snapshot',
	link: async () => false,
	misdeclared: () => [],
	drift: async () => ({ mutated: [], added: [] }),
	artifact: async () => undefined,
	remove: async () => undefined
} as unknown as SnapshotAdapter;

/** Runs the config with fakes for the snapshot, the command runner and build identity. */
async function execute(needed?: ReadonlySet<string> | 'all') {
	const ran: string[] = [];
	const identified: string[] = [];
	vi.spyOn(SnapshotAdapter, 'create').mockResolvedValue(snapshot);
	vi.spyOn(CheckRunService.prototype, 'run').mockImplementation(async (check) => {
		ran.push(check.command);
		return { passed: true } as CheckOutcome;
	});
	vi.spyOn(BuildIdentityService.prototype, 'declared').mockImplementation(async (_root, builds) => {
		identified.push(...builds.map((build) => build.id));
		const found = builds.map((build) => ({ ...build, buildId: `identity-${build.id}`, files: 1 }));
		return { found, failures: [] };
	});
	vi.spyOn(BuildIdentityService.prototype, 'changed').mockResolvedValue([]);
	const context = { directory: '/run', commit: 'commit', tree: 'tree', profile: 'test', env: {} };
	const service = new SnapshotRunService({ root: '/repo', config, context, needed });
	return { executed: await service.execute([]), ran, identified };
}

test('a scoped run runs the setup steps that name no build or a needed one, and skips the rest', async () => {
	const { ran } = await execute(new Set(['web']));
	expect(ran).toEqual(['install', 'build web']);
});

test('a scoped run identifies only the builds it needs and names the rest as skipped', async () => {
	const { executed, identified } = await execute(new Set(['web']));
	expect(identified).toEqual(['web']);
	expect(executed.builds).toEqual([
		{ id: 'web', directory: 'web/dist', buildId: 'identity-web', files: 1 }
	]);
	expect(executed.skippedBuilds).toEqual(['docs']);
});

test.each([undefined, 'all'] as const)(
	'without a scope (needed: %s) every step runs, every build is identified and none is skipped',
	async (needed) => {
		const { executed, ran, identified } = await execute(needed);
		expect(ran).toEqual(['install', 'build web', 'build docs']);
		expect(identified).toEqual(['web', 'docs']);
		expect(executed).not.toHaveProperty('skippedBuilds');
	}
);

test('enrolled snapshots expose only pending owning slots from original repository evidence', async () => {
	// The case tests real child-process transport; shared host queue admission has its own suite.
	vi.spyOn(resourceAdmission, 'resourceWork').mockImplementation(async (_request, action) =>
		action({ id: 'snapshot-capture-fixture', env: {}, track: () => undefined })
	);
	await measureWorkload(
		'service.snapshot-run',
		'pending-original-evidence-capture-environment',
		() => withTempRepo(assertSnapshotCaptureEnvironment)
	);
});
