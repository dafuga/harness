import { isDeepStrictEqual } from 'node:util';

export const spokeNode = 'fixture-linux';
export const spokeItem = { itemId: 'linux-item', fields: { title: 'Linux fixture item' } };
export const fixtureClock = 5000;
const hlc = '000000000005000-000000-fixture-linux';

const push = [
	'POST',
	'/sync/push',
	JSON.stringify({
		node: spokeNode,
		ops: [
			{
				seq: 1,
				op_id: hlc,
				item_id: spokeItem.itemId,
				fields: spokeItem.fields,
				hlc,
				node: spokeNode
			}
		]
	})
];
const pull = ['GET', '/sync/pull?since=0&wait=0'];

/** Admit only the two exact requests needed by this disposable fixture, in order. */
export function relayScope(signAndSend) {
	const allowed = [push, pull];
	const totals = { accepted: 0, denied: 0, malformed: 0 };
	return {
		totals,
		async reply(frame) {
			let tuple;
			try {
				tuple = JSON.parse(frame);
			} catch {
				totals.malformed++;
				return [400];
			}
			if (!isDeepStrictEqual(tuple, allowed[totals.accepted])) {
				totals.denied++;
				return [403];
			}
			totals.accepted++;
			const [method, pathAndQuery, body] = tuple;
			return signAndSend({ method, pathAndQuery, body });
		}
	};
}

export const deniedRequests = [
	['GET', '/sync/health'],
	['POST', '/sync/machine', '{}'],
	['POST', '/sync/permit-due', '{}'],
	['GET', '/sync/pull?since=0&wait=25'],
	['GET', '/sync/pull?since=0&wait=0&since=1'],
	['GET', 'http://127.0.0.1:7702/sync/pull?since=0&wait=0'],
	['GET', '/sync/push', push[2]],
	[...push, { authorization: 'caller-supplied' }],
	['POST', '/sync/push', push[2].replace('"node":"fixture-linux"', '"node":"other-node"')],
	['POST', '/sync/push', push[2].replace('"item_id":"linux-item"', '"item_id":"other-item"')],
	pull
];
