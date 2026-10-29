import { expect, test } from 'vitest';
import { captureExample } from '../support/captureExample';
import { packer } from '../../src/utils/packer';
test('packer: numeric text', async () => { const actual = await packer('123'); expect(actual).toEqual("123"); captureExample({ unit: 'function.packer', id: 'numeric-text', state: 'initialized' }, actual, "123"); });
