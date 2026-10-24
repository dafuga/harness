import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('dependencies view uses its dedicated screen and shared scoped host', () => {
	const source = readFileSync(
		'src/routes/harness/branch/[branch]/[...at]/dependencies/+page.svelte',
		'utf8'
	);
	expect(source).toContain('content={ExplorerDependenciesScreen}');
	expect(source).toContain('HarnessScreen title="Dependencies"');
});
