import { expect, test } from 'vitest';
import { HostObjectController } from '../../src/lib/execution-runtimes/host-runtime/HostObjectController';
import type { RelayEnv } from '../../src/models/networking-security/RelayHost.types';
import { PairingOfferService } from '../../src/lib/execution-runtimes/host-runtime/PairingOfferService';
import { SocketFrameService } from '../../src/lib/execution-runtimes/host-runtime/socket-frame-service/SocketFrameService';
import { hostRuntime } from '../../src/lib/execution-runtimes/host-runtime/hostRuntime';

test('hostRuntime wires the parts of one host object without touching its state', () => {
	const touched: string[] = [];
	const state = new Proxy(
		{},
		{
			get: (_target, property) => {
				touched.push(String(property));
				return undefined;
			}
		}
	) as unknown as DurableObjectState;
	const runtime = hostRuntime(state, {} as RelayEnv);
	expect(runtime.http).toBeInstanceOf(HostObjectController);
	expect(runtime.frames).toBeInstanceOf(SocketFrameService);
	expect(runtime.offers).toBeInstanceOf(PairingOfferService);
	expect(touched.filter((property) => property !== 'storage')).toEqual([]);
});
