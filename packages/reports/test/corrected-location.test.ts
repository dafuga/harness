import { expect, test } from 'vitest';
import type { ExplorerEntity, ExplorerLocation } from '../src/models/Explorer.types';
import { correctedLocation } from '../src/utils/correctedLocation';

/**
 * An entity is addressed under the category it has at the shown revision. An old address of a
 * unit that is now a shell leads to Shells with everything else kept; where it is a component, or
 * is not there at all, the address stays as it was.
 */
const frame = 'desktop.component.workspace-shell';
const listed = (category: string) => [{ id: frame, category }] as unknown as ExplorerEntity[];
const at: ExplorerLocation = {
	branch: 'feat/x',
	commit: 'a'.repeat(40),
	category: 'components',
	entity: frame,
	section: 'details',
	tab: 'source'
};

test('a shell addressed under Components is led to Shells, keeping branch, commit, section and tab', () => {
	expect(correctedLocation(at, listed('shells'))).toEqual({ ...at, category: 'shells' });
	const tip = { ...at, commit: null, section: undefined, tab: undefined };
	expect(correctedLocation(tip, listed('shells'))).toEqual({ ...tip, category: 'shells' });
});

test('where the unit is a component at that revision, or is not there, the address stays', () => {
	expect(correctedLocation(at, listed('components'))).toBeNull();
	expect(correctedLocation(at, [])).toBeNull();
	expect(correctedLocation({ ...at, entity: undefined }, listed('shells'))).toBeNull();
});
