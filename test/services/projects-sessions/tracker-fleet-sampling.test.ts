import { expect, test } from 'vitest';
import { call, fleet, hubNode, peerNode } from '../../support/trackerFleetFixture';

test('a hub that cannot sample itself still reports its launcher and its peers', async () => {
	const nodes = fleet({
		machineSampler: {
			sample: async () => {
				throw new Error('fixture sampler failure');
			}
		}
	});
	try {
		await nodes.hub.telemetry!(new AbortController().signal);
		expect(nodes.hub.fleetSamples!()).toMatchObject([{ node: hubNode }]);
		await nodes.peer.telemetry!(new AbortController().signal);
		const { data } = await call(nodes.hub, ['machines']);
		expect(data.find(({ node }: { node: string }) => node === peerNode)).toBeDefined();
	} finally {
		nodes.close();
	}
});
