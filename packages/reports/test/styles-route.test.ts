import { expect, test } from 'vitest';
import {
	explorerRoute,
	explorerRoutePath,
	type ExplorerLocation
} from '../../../src/utils/explorerRoute';

const styleView = (branch: string | null, commit: string | null): ExplorerLocation => ({
	branch,
	commit,
	category: 'pages',
	screen: 'styles'
});

test('Styles addresses round-trip with a branch or selected commit, without becoming a category', () => {
	const current = styleView('feature/styles#1', null);
	const historical = styleView('main', 'a'.repeat(40));
	expect(explorerRoute('/branch/feature%2Fstyles%231/styles')).toEqual(current);
	expect(explorerRoutePath(current)).toBe('/branch/feature%2Fstyles%231/styles');
	expect(explorerRoute('/branch/main/commit/' + 'a'.repeat(40) + '/styles')).toEqual(historical);
	expect(explorerRoutePath(historical)).toBe('/branch/main/commit/' + 'a'.repeat(40) + '/styles');
});
