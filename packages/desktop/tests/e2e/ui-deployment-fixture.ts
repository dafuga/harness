const deploymentFixture = {
	statuses: ['dev', 'stage', 'preprod', 'prod'].map((environment) => ({
		environment,
		available: true,
		reason: 'Cloudflare target configured.',
		receipt: true
			? {
					environment,
					commit: environment === 'prod' ? 'b'.repeat(40) : 'c'.repeat(40),
					branch: 'feat/activity',
					updatedAt: '2026-10-20T10:15:00.000Z',
					adapter: 'cloudflare',
					deploymentId: 'fixture-' + environment,
					url: 'https://example.invalid'
				}
			: null
	})),
	plan: {
		id: 'reviewed-fixture',
		branch: 'feat/activity',
		adapter: 'cloudflare',
		steps: [
			'Run bun run check',
			'Build the source commit',
			'Deploy with Cloudflare',
			'Verify deployment identity and health'
		],
		blockers: [],
		expiresAt: '2026-10-20T23:59:00.000Z'
	},
	receipt: {
		environment: 'prod',
		commit: 'c'.repeat(40),
		branch: 'feat/activity',
		updatedAt: '2026-10-20T11:00:00.000Z',
		adapter: 'cloudflare',
		deploymentId: 'fixture-prod',
		url: 'https://example.invalid'
	}
};
function installDeployment(data: typeof deploymentFixture & { steps: typeof activitySteps }) {
	const host = window as unknown as { harness: object; __calls: unknown[] };
	let current = { at: 0, id: '' };
	function job() {
		if (!current.at) return null;
		const complete = Date.now() - current.at >= 1800;
		return {
			id: current.id,
			projectId: 'local-' + 'a'.repeat(64),
			projectName: 'Test project',
			environment: 'prod',
			commit: 'c'.repeat(40),
			branch: 'feat/activity',
			steps: data.steps,
			phase: complete ? 'complete' : 'checking',
			step: complete ? 'verifying' : 'checking',
			detail: complete ? 'Deployed to prod' : 'Checking the preprod commit',
			error: null,
			receipt: complete ? data.receipt : null,
			createdAt: '2026-10-20T10:15:00.000Z',
			updatedAt: '2026-10-20T10:16:00.000Z',
			startedAt: '2026-10-20T10:15:00.000Z',
			finishedAt: complete ? '2026-10-20T10:16:00.000Z' : null
		};
	}
	Object.assign(host.harness, {
		deploymentStatus: async () =>
			data.statuses.map((status) =>
				status.environment === 'prod' && job()?.phase === 'complete'
					? { ...status, receipt: data.receipt }
					: status
			),
		deploymentActivities: async () => (job() ? [job()] : []),
		planDeployment: async (input: { environment: string; commit: string }) => {
			host.__calls.push({ op: 'planDeployment', ...input });
			return {
				...data.plan,
				environment: 'prod',
				commit: 'c'.repeat(40),
				target: 'workers · example-prod',
				promotion: {
					preprod: data.statuses[2].receipt,
					production: data.statuses[3].receipt,
					commitsBehind: 3
				}
			};
		},
		startDeployment: async (input: { planId: string }) => {
			host.__calls.push({ op: 'deploy', ...input });
			current = { at: Date.now(), id: input.planId };
			return job();
		}
	});
}

export async function installDeploymentFixture(page: import('@playwright/test').Page) {
	await page.addInitScript(installDeployment, { ...deploymentFixture, steps: activitySteps });
}
const activitySteps = [
	{ id: 'preparing', title: 'Prepare source' },
	{ id: 'checking', title: 'Run checks' },
	{ id: 'building', title: 'Build source' },
	{ id: 'uploading', title: 'Deploy to Cloudflare' },
	{ id: 'verifying', title: 'Verify health' }
];
function installActivity({
	steps,
	interrupted
}: {
	steps: typeof activitySteps;
	interrupted: boolean;
}) {
	const host = window as unknown as { harness: object };
	const jobs = ['prod', 'preprod', 'stage', 'dev'].map((environment, index) => ({
		id: 'deployment-' + environment,
		projectId: 'local-' + 'a'.repeat(64),
		projectName: 'Test project',
		environment,
		commit: String.fromCharCode(99 + index).repeat(40),
		branch: 'feat/activity',
		steps,
		phase: ['checking', 'uploading', 'building', 'complete'][index],
		step: ['checking', 'uploading', 'building', 'verifying'][index],
		detail: ['Running prod checks', 'Uploading preprod', 'Building stage', 'Deployed to dev'][
			index
		],
		error: null,
		receipt: null,
		createdAt: '2026-10-20T10:15:00.000Z',
		updatedAt: '2026-10-20T10:16:00.000Z',
		startedAt: '2026-10-20T10:15:00.000Z',
		finishedAt: index === 3 ? '2026-10-20T10:16:00.000Z' : null
	}));
	if (interrupted) {
		Object.assign(jobs[0], {
			phase: 'queued',
			step: null,
			detail: 'Queued for prod',
			startedAt: null
		});
		Object.assign(jobs[1], {
			phase: 'failed',
			error: 'Cloudflare upload failed',
			detail: 'Deployment failed',
			finishedAt: '2026-10-20T10:16:00.000Z'
		});
		Object.assign(jobs[2], {
			phase: 'complete',
			detail: 'Deployed to stage',
			finishedAt: '2026-10-20T10:16:00.000Z'
		});
	}
	let reads = 0;
	Object.assign(host.harness, {
		deploymentActivities: async () => {
			if (interrupted && ++reads > 2) throw new Error('Fixture status unavailable');
			return jobs;
		}
	});
}
export async function fakeDeploymentActivity(
	page: import('@playwright/test').Page,
	interrupted = false
) {
	await page.addInitScript(installActivity, { steps: activitySteps, interrupted });
}
