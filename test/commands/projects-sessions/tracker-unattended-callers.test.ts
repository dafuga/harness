import { expect, test } from 'vitest';
import { channelItem, withTrackerCliChannel } from '../../support/trackerCliChannel';
import { trackerUnattendedCallers } from '../../support/trackerUnattendedCallers';

const cases = trackerUnattendedCallers.flatMap(({ caller, calls }) =>
	calls.map((call) => ({ caller, ...call }))
);

test.each(cases)('$caller: tracker $args.0 is $outcome', ({ args, outcome }) =>
	withTrackerCliChannel(async ({ run, items, inbox }) => {
		const { code, out } = await run(...args.map((word) => (word === 'ITEM' ? channelItem : word)));
		const asked = items.getStored(channelItem).needs_daniel;
		if (outcome !== 'kept') {
			expect({ code, asked }, out).toEqual({ code: 0, asked: outcome === 'asks' });
			return;
		}
		expect({ code, asked }, out).toEqual({ code: 1, asked: false });
		expect(items.getStored(channelItem).notes_log.at(-1)?.text ?? '').toContain(args[2]);
		expect(inbox()).toMatchObject([{ item_id: channelItem, kind: 'flag-refused' }]);
	})
);
