import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
test('Translations mounts its dedicated screen inside the existing scoped host', () => {
	const source = readFileSync(
		'src/routes/harness/branch/[branch]/[...at]/translations/+page.svelte',
		'utf8'
	);
	expect(source).toContain('content={ExplorerTranslationsScreen}');
	expect(source).toContain('title="Translations"');
});
