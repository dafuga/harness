import { afterEach, expect, test, vi } from 'vitest';
import { reportPages } from '../../src/utils/reportPages';
import type { PublicationBundle } from '../../src/utils/reportPublication';
const { processReport } = vi.hoisted(() => ({ processReport: vi.fn() }));
vi.mock('../../src/utils/reportProcess', () => ({ reportProcess: processReport }));
afterEach(() => {
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});
test('Pages publication pins this account and selected report branch and returns its HTTPS URL', async () => {
	vi.stubEnv('PROJECT_REPORTS_R2_ACCOUNT_ID', 'reports-account');
	vi.stubEnv('PROJECT_REPORTS_PAGES_PROJECT', 'project-report-shares');
	vi.stubEnv('PROJECT_REPORTS_CLOUDFLARE_CONFIG_HOME', '/tmp/reports-auth');
	processReport.mockResolvedValue({
		code: 0,
		output: 'Complete https://abc.project-report-shares.pages.dev'
	});
	const bundle = {
		id: 'report-1',
		directory: '/tmp/report-artifact',
		revision: 'a'.repeat(40)
	} as PublicationBundle;
	expect(await reportPages(bundle)).toBe('https://abc.project-report-shares.pages.dev');
	const args = processReport.mock.calls[0];
	expect(args[1]).toContain('--branch');
	expect(args[1]).toContain('report-report-1');
	expect(args[3].CLOUDFLARE_ACCOUNT_ID).toBe('reports-account');
	expect(args[3].XDG_CONFIG_HOME).toBe('/tmp/reports-auth');
});
test('a failed deploy or unrelated project URL is not accepted as published', async () => {
	vi.stubEnv('PROJECT_REPORTS_R2_ACCOUNT_ID', 'reports-account');
	processReport.mockResolvedValue({ code: 1, output: 'Failed' });
	await expect(reportPages({ id: 'report-1' } as PublicationBundle)).rejects.toThrow(
		/publication failed/
	);
	processReport.mockResolvedValue({ code: 0, output: 'https://abc.unrelated.pages.dev' });
	await expect(reportPages({ id: 'report-1' } as PublicationBundle)).rejects.toThrow(
		/deployment URL/
	);
});
