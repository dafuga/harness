import { expect, test } from '@playwright/test';
import { seeded } from './support/harnessHistory';

const { commits } = seeded();
const main = (commit: string, rest: string) => `/harness/branch/main/commit/${commit}/${rest}`;

test('pages, redirects and data of the console are never left to a shared cache', async ({
	request
}) => {
	const addresses = [
		'/harness',
		`/harness?view=history&commit=${commits.reordered}`,
		main(commits.reordered, 'history'),
		'/harness/data/index.json',
		'/harness/reports',
		'/harness/analytics',
		'/reports/anything'
	];
	for (const address of addresses) {
		const response = await request.get(address, { maxRedirects: 0 });
		const cached = response.headers()['cache-control'] ?? '';
		expect([address, /private|no-store/.test(cached), /public/.test(cached)]).toEqual([
			address,
			true,
			false
		]);
	}
	const redirect = await request.get('/harness', { maxRedirects: 0 });
	expect([redirect.status(), redirect.headers()['cache-control']]).toEqual([
		308,
		'private, no-store'
	]);
});
