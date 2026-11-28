import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The repository's completion checks, plus a reducible module when a test enables them. */
export async function writeCompletionFixture(root: string, completion: unknown): Promise<void> {
	const disabled = [
		{ name: 'reduce-module-bytes', scope: 'module', enabled: false },
		{ name: 'simplify-contract', scope: 'orchestrator', enabled: false }
	];
	await writeFile(
		join(root, 'harness.completion.json'),
		JSON.stringify(completion ?? { checks: disabled })
	);
	if (!completion) return;
	await writeFile(
		join(root, 'src/orders.ts'),
		`// Comments that repeat the details of order validation.
export function orders(valid = true) {
	if (valid) return 2;
	return 0;
}
`
	);
	await writeFile(
		join(root, 'src/orders.test.ts'),
		`import { test, expect } from 'bun:test';
import { orders } from './orders';
// Duplicate notes about the expected results below.
test('orders', () => {
	expect(orders(true)).toBe(2);
	expect(orders(false)).toBe(0);
});
`
	);
}
