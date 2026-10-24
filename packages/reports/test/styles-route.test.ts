import { expect, test } from 'vitest';
import {
	explorerRoute,
	explorerRoutePath,
	type ExplorerLocation
} from '../../../src/utils/explorerRoute';

const styleView = (branch: string | null, commit: string | null, screen = 'styles'): ExplorerLocation => ({
	branch,
	commit,
	category: 'pages',
	screen: screen as ExplorerLocation['screen']
});

test.each(['styles', 'translations'])('%s addresses round-trip with a branch or selected commit, without becoming a category', (screen) => {
	const current = styleView('feature/styles#1', null, screen);
	const historical = styleView('main', 'a'.repeat(40), screen);
	expect(explorerRoute(`/branch/feature%2Fstyles%231/${screen}`)).toEqual(current);
	expect(explorerRoutePath(current)).toBe(`/branch/feature%2Fstyles%231/${screen}`);
	expect(explorerRoute('/branch/main/commit/' + 'a'.repeat(40) + '/' + screen)).toEqual(historical);
	expect(explorerRoutePath(historical)).toBe('/branch/main/commit/' + 'a'.repeat(40) + '/' + screen);
});
