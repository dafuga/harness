import { expect, test } from 'vitest';
import { captureExample } from '../support/captureExample';
import { extra } from '../../src/utils/extra';
test('extra: loads a named data module', async () => { const actual = await ({ ...(await extra('data:text/javascript,export default 123')) }); expect(actual).toEqual({"default":123}); captureExample({ unit: 'function.extra', id: 'data-module', state: 'initialized' }, actual, {"default":123}); });
