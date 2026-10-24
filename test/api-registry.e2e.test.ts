import { expect } from './verificationExpect';
import { test } from 'vitest';
import { apiFixture } from './support/api-cli/apiFixture';

test.each(['local', 'hosted'] as const)(
	'API CLI lists every registered %s unit, including backend entries outside the catalog',
	async (mode) => {
		const f = await apiFixture(mode);
		try {
			const result = await f.cli(['get', 'units']);
			expect(JSON.parse(result.stdout).map((unit: { id: string }) => unit.id)).toContain(
				'entry.program'
			);
		} finally {
			await f.close();
		}
	},
	30000
);

test.each(['local', 'hosted'] as const)(
	'API CLI reads %s backend contracts without relying on a visual catalog entry',
	async (mode) => {
		const f = await apiFixture(mode);
		try {
			const result = await f.cli(['contracts', 'get', 'entry.program']);
			expect(JSON.parse(result.stdout)).toMatchObject({
				outputs: [{ name: 'buildProgram', type: 'Command' }]
			});
		} finally {
			await f.close();
		}
	},
	30000
);
