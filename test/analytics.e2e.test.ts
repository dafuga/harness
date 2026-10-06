import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { runHarness } from './support/cli';

test('analytics imports loops idempotently and provides linked models and reports', async () => {
	const root = await mkdtemp(join(tmpdir(), 'harness-analytics-'));
	const previous = process.env.HARNESS_ANALYTICS_HOME;
	process.env.HARNESS_ANALYTICS_HOME = join(root, 'analytics');
	try {
		await createDelivery(root);
		await runHarness(['analytics', 'import', '--root', root], root);
		await runHarness(['analytics', 'import', '--root', root], root);
		const loops = JSON.parse((await runHarness(['analytics', 'loops', '--json'], root)).stdout);
		expect(loops.loops).toHaveLength(1);
		expect(loops.loops[0]).toMatchObject({
			name: 'delivery',
			agentModel: 'gpt-test',
			template: 'feature'
		});
		await writeFile(join(root, 'request.txt'), 'Say hello');
		await writeFile(join(root, 'response.txt'), 'Hello');
		await runHarness(
			[
				'response-check',
				'--request',
				'request.txt',
				'--response',
				'response.txt',
				'--dry-run',
				'--loop',
				'delivery',
				'--step',
				'implement'
			],
			root
		);
		const jev = JSON.parse((await runHarness(['analytics', 'jev', '--json'], root)).stdout);
		expect(jev.jev.response.firstTry.denominator).toBe(0);
		expect(jev.jev.response.excluded).toBeGreaterThan(0);
		await verifyReport(root);
	} finally {
		if (previous === undefined) delete process.env.HARNESS_ANALYTICS_HOME;
		else process.env.HARNESS_ANALYTICS_HOME = previous;
		await rm(root, { recursive: true, force: true });
	}
}, 30_000);

async function createDelivery(root: string): Promise<void> {
	await runHarness(
		[
			'loop',
			'create',
			'delivery',
			'--from',
			'feature',
			'--goal',
			'Deliver',
			'--agent-model',
			'gpt-test'
		],
		root
	);
}

async function verifyReport(root: string): Promise<void> {
	const report = JSON.parse(
		(
			await runHarness(
				[
					'report',
					'begin',
					'--project',
					root,
					'--title',
					'Analytics',
					'--mode',
					'feature',
					'--environment',
					'test'
				],
				root
			)
		).stdout
	);
	expect(report.run).toBeTruthy();
}
