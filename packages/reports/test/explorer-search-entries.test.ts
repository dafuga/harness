import { expect, test } from 'vitest';
import { explorerEntities } from '../src/utils/explorerEntities';
import { explorerSearchEntries } from '../src/utils/explorerSearchEntries';
import { revision, sha, unit } from './explorerFixture';

/**
 * What the explorer searches of a revision: each entity it shows with its name, its purpose and
 * the names of its declared contract, at the commit it was read at. No source path is searched.
 */
const field = (name: string) => ({ name, type: 'string' });
const units = [
	unit('app.page.orders', 'page', { title: 'Orders' }),
	unit('app.shell.order-frame', 'shell', { title: 'Order frame' }),
	unit('app.function.format-time', 'function', {
		title: 'formatTime',
		contract: {
			inputs: [field('placedAt')],
			outputs: [field('elapsed')],
			errors: [field('in-future')]
		}
	}),
	unit('app.service.refunds', 'service', { title: 'Refund service' })
];
const parent = revision([...units, unit('app.config.gone', 'config')], [], [], {
	commit: sha('b')
});
const head = revision(units, [], [], { commit: sha('a') });

test('each shown entity is one entry with its name, purpose, contract names and revision', () => {
	const shown = explorerEntities(head, parent).filter((entity) => entity.change !== 'removed');
	expect(explorerSearchEntries(explorerEntities(head, parent), sha('a'))).toEqual(
		shown.map((entity) => ({
			id: entity.id,
			category: entity.category,
			name: entity.name,
			purpose: entity.purpose,
			terms: entity.id === 'app.function.format-time' ? ['placedAt', 'elapsed', 'in-future'] : [],
			commit: sha('a')
		}))
	);
});

test('a unit the commit removed is not searched, and no entry holds a source path', () => {
	const entries = explorerSearchEntries(explorerEntities(head, parent), sha('a'));
	expect(entries.map((entry) => entry.id)).not.toContain('app.config.gone');
	expect(JSON.stringify(entries)).not.toContain('src/');
});
