import { expect } from './verificationExpect';
import { test } from 'vitest';
import { apiFixture, commit } from './support/api-cli/apiFixture';

test.each(['local', 'hosted'] as const)(
	'API CLI refuses %s contract writes when a historical commit is selected',
	async (mode) => {
		const f = await apiFixture(mode);
		try {
			const plan = {
				category: 'functions',
				title: 'Read only',
				goal: 'Stay at the selected revision',
				contract: { inputs: [], outputs: [], errors: [] }
			};
			const result = await f.cli(
				['contracts', 'define', '--commit', commit, '--input', JSON.stringify(plan)],
				false
			);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toMatch(/branch tip|historical/i);
			expect(f.seen.filter((request) => request.operation === 'createPlan')).toHaveLength(0);
		} finally {
			await f.close();
		}
	},
	30000
);

test('API CLI supplies numeric local history pagination while retaining entity and revision binding', async () => {
	const f = await apiFixture('local');
	try {
		await f.cli(['get', 'history', 'page.example']);
		expect(f.seen.find((request) => request.operation === 'history')?.input).toMatchObject({
			page: 1,
			entityId: 'page.example',
			commit
		});
		await f.cli(['get', 'history', 'page.example', '--query', 'page=2']);
		expect(f.seen.filter((request) => request.operation === 'history').at(-1)?.input.page).toBe(2);
	} finally {
		await f.close();
	}
}, 30000);

test.each(['local', 'hosted'] as const)(
	'API CLI shows only the selected %s run in agent events',
	async (mode) => {
		const f = await apiFixture(mode);
		try {
			const result = await f.cli(['agents', 'events', 'run-1']);
			expect(
				JSON.parse(result.stdout).events.map(
					(event: { value: { runId: string } }) => event.value.runId
				)
			).toEqual(['run-1']);
		} finally {
			await f.close();
		}
	},
	30000
);
