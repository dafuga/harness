import { test } from './support/browserTest';
import { capturePage } from '../../test/support/capturePage';
test.describe('titles view route is generated', () => {
test.describe('desktop viewport', () => {
test.use({ viewport: {"width":1440,"height":900} });
test('empty', async ({ page, matchScreenshot }, info) => capturePage({ page, matchScreenshot, info, state: 'empty', viewport: {"id":"desktop","width":1440,"height":900} }));
test('filled', async ({ page, matchScreenshot }, info) => capturePage({ page, matchScreenshot, info, state: 'filled', viewport: {"id":"desktop","width":1440,"height":900} }));
});
test.describe('tablet viewport', () => {
test.use({ viewport: {"width":920,"height":800} });
test('empty', async ({ page, matchScreenshot }, info) => capturePage({ page, matchScreenshot, info, state: 'empty', viewport: {"id":"tablet","width":920,"height":800} }));
test('filled', async ({ page, matchScreenshot }, info) => capturePage({ page, matchScreenshot, info, state: 'filled', viewport: {"id":"tablet","width":920,"height":800} }));
});
test.describe('mobile viewport', () => {
test.use({ viewport: {"width":390,"height":844} });
test('empty', async ({ page, matchScreenshot }, info) => capturePage({ page, matchScreenshot, info, state: 'empty', viewport: {"id":"mobile","width":390,"height":844} }));
test('filled', async ({ page, matchScreenshot }, info) => capturePage({ page, matchScreenshot, info, state: 'filled', viewport: {"id":"mobile","width":390,"height":844} }));
});
});
