import { expect, test } from 'vitest';
import { channelItem, withTrackerCliChannel } from '../../support/trackerCliChannel';
import { trackerUnattendedCallers } from '../../support/trackerUnattendedCallers';

const cases = trackerUnattendedCallers.flatMap(({ caller, calls }) =>
	calls.map((call) => ({ caller, ...call }))
);

test.each(cases)('$caller: tracker $args.0 is $outcome', ({ args, outcome }) =>
	withTrackerCliChannel(async ({ run, items, inbox }) => {
		const { code, out } = await run(...args.map((word) => (word === 'ITEM' ? channelItem : word)));
		const item = items.getStored(channelItem);
		expect({ code, asked: item.needs_daniel }, out).toEqual({
			code: outcome === 'kept' ? 1 : 0,
			asked: outcome === 'asks'
		});
		if (outcome !== 'alerts' && outcome !== 'kept') return;
		expect(item.notes_log.at(-1)?.text ?? '').toContain(args[2]);
		expect(inbox()).toMatchObject([
			{
				item_id: channelItem,
				kind: outcome === 'alerts' ? 'alert' : 'flag-refused',
				reason: expect.stringContaining(args[2])
			}
		]);
	})
);
