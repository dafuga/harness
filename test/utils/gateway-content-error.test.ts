import { expect, test } from 'vitest';
import { gatewayContentError } from '../../src/utils/gatewayContentError';
test('media validation errors have a distinct safe response classification', () => {
	expect(gatewayContentError('Unsupported media')).toMatchObject({
		name: 'GatewayContentError',
		message: 'Unsupported media'
	});
});
