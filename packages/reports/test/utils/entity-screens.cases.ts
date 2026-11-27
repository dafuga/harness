import { measureWorkload } from '../../../../test/support/measureWorkload';
import { evidence } from './entityScreenFixture';
import { expect, test } from 'vitest';
import { catalogShot } from '../../src/utils/explorer-ui/entityScreens';
import { record, revision } from '../entityFixture';
import { commits, ids, units } from '../entityUnits';
import { withFocused } from '../entityStates';

export const page = units.find((unit) => unit.id === ids.page)!;
export const head = revision(commits.middle, [record(commits.middle)]);
test('source-identical squash previews retain origin and reject a changed source tree', async () =>
	measureWorkload('reports.function.entity-screens', 'entity-screens-normal-behavior', async () => {
		const captured = withFocused(head, ids.page);
		const sourceTree = 'e'.repeat(40);
		const point = { ...captured.regressions![0].green!, sourceTree };
		const squashed = {
			...captured,
			commit: commits.tip,
			side: `sides/${sourceTree}.json`,
			regressions: [{ ...captured.regressions![0], green: point }]
		};
		const found = evidence(page, squashed);
		expect(
			catalogShot(found),
			'source-identical squash displays original screenshot'
		).not.toBeNull();
		expect(catalogShot(found)?.source).toBe(commits.middle);
		expect(
			found.after.captures.every((item) => !item.current && item.inheritedFrom === commits.middle)
		).toBe(true);
		expect(
			catalogShot(evidence(page, { ...squashed, side: `sides/${'f'.repeat(40)}.json` }))
		).toBeNull();
	}));
