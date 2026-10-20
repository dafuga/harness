import { expect, test } from 'vitest';
import { deviceCapabilities } from '../../src/services/device-operations-service/deviceCapabilities';

test('a device with the agents permission has what the desktop has', () => {
	expect(deviceCapabilities(true)).toMatchObject({
		comments: true,
		agents: true,
		planning: true,
		approval: true,
		source: 'local'
	});
});
test('a device without it reads and comments, and says why', () => {
	const capabilities = deviceCapabilities(false);
	expect(capabilities).toMatchObject({
		comments: true,
		agents: false,
		planning: false,
		approval: false,
		source: 'local'
	});
	expect(capabilities.reason).toMatch(/approved/i);
});
