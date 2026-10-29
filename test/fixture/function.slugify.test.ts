import { captureExample } from '../support/captureExample';
import { expect, test } from 'vitest';
import { slugify } from '../../src/utils/slugify';
test('slugify: numeric text', () => {
 const actual = slugify(' 123 ');
 expect(actual).toBe('123');
 captureExample({ unit: 'function.slugify', id: 'numeric-text', state: 'initialized' }, actual, '123');
});
