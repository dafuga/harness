import { afterEach, expect, test, vi } from 'vitest';
import { configureFixtureCloud } from '../storageFixture';
import { ReportPagesRetentionAdapter } from '../../src/adapters/ReportPagesRetentionAdapter';
afterEach(() => vi.unstubAllEnvs());
const receipt = { run: 'old', url: 'https://abcd.project-report-shares.pages.dev' };
const row = {
	Id: '593b6ba3-5fc3-4589-a6b0-20996cb8f911',
	Environment: 'Preview',
	Branch: 'report-old',
	Deployment: receipt.url
};
test('publication cleanup only removes matching report previews and supports dry runs', async () => {
	configureFixtureCloud();
	const command = vi.fn().mockResolvedValue({
		code: 0,
		output: JSON.stringify([
			row,
			{ ...row, Id: 'other', Branch: 'report-fresh' },
			{ ...row, Environment: 'Production' }
		])
	});
	const adapter = new ReportPagesRetentionAdapter(command);
	expect(await adapter.purge(receipt, true)).toBe(1);
	expect(command).toHaveBeenCalledTimes(1);
	await adapter.purge(receipt);
	expect(command).toHaveBeenCalledTimes(3);
	expect(command.mock.calls[2][1]).toContain(row.Id);
	expect(command.mock.calls[2][1]).toContain('--force');
});
test('a live unlisted publication preserves its receipt, and unrelated projects are rejected', async () => {
	configureFixtureCloud();
	const command = vi.fn().mockResolvedValue({ code: 0, output: '[]' });
	const request = vi.fn().mockResolvedValue(new Response('live', { status: 200 }));
	await expect(new ReportPagesRetentionAdapter(command, request).purge(receipt)).rejects.toThrow(
		'retained'
	);
	expect(command).toHaveBeenCalledTimes(1);
	await expect(
		new ReportPagesRetentionAdapter(command).purge({
			...receipt,
			url: 'https://abcd.unrelated-project.pages.dev'
		})
	).rejects.toThrow('project');
});
