import { expect, test } from 'vitest';
import type { EntityDetail, ThreadInfo } from '../src/models/Desktop.types';
import type { RunRequest } from '../src/models/DesktopBridge.types';
import { approvalMatch } from '../src/utils/approvalMatch';
import { runPayload } from '../src/utils/ipcPayload';

/**
 * What is refused before any work: a design option count that is not a whole number from 1 to 10,
 * any count on a Change, an option name outside o1 to o10, and a Change whose approved option is not
 * the one its thread is on. A revised single design keeps its approve then Change path.
 */
const hash = (c: string) => c.repeat(64);
const plan = {
	...{ mode: 'plan', approval: null, provider: 'codex', model: 'selected', effort: null },
	...{ entityId: 'page.home', threadId: 't1', text: 'Design it' }
};
const approved = (option?: string) => ({
	...{ version: 'v002', imageHashes: [hash('b')], contractHash: hash('c') },
	...(option ? { option } : {})
});
const change = (option?: string) =>
	({ ...plan, mode: 'change', approval: approved(option) }) as RunRequest;
/** Home revised once, v002 approved (as `option` when given), with one thread anchored as stated. */
const home = (anchor: Partial<ThreadInfo>, option?: string) =>
	({
		latestVersion: 'v002',
		contract: { hash: hash('c') },
		versions: [
			{ version: 'v001', approval: null },
			{
				version: 'v002',
				approval: { ...approved(option), id: 'a', approvedAt: 'x', current: true }
			}
		],
		threads: [{ id: 't1', version: null, ...anchor }]
	}) as unknown as EntityDetail;

test('a Plan payload keeps a count from 1 to 10 and refuses any other', () => {
	expect(runPayload(plan)).not.toHaveProperty('designOptions');
	expect(runPayload({ ...plan, designOptions: 4 })).toMatchObject({ designOptions: 4 });
	for (const designOptions of [0, 11, 2.5, '3', null])
		expect(() => runPayload({ ...plan, designOptions })).toThrow('from 1 to 10');
});

test('a Change payload names at most one option o1 to o10 and asks for no count', () => {
	expect(runPayload({ ...plan, mode: 'change', approval: approved('o2') })).toMatchObject({
		approval: { option: 'o2' }
	});
	expect(() => runPayload({ ...plan, mode: 'change', approval: approved('o11') })).toThrow();
	expect(() => runPayload({ ...change(), designOptions: 1 })).toThrow(
		'A Change makes no design options.'
	);
});

test('a creation payload keeps a count from 1 to 10 and refuses any other', () => {
	const create = { ...plan, intent: 'create', category: 'pages', projectId: `local-${hash('d')}` };
	for (const key of ['approval', 'entityId', 'threadId'])
		delete (create as Record<string, unknown>)[key];
	expect(runPayload({ ...create, designOptions: 2 })).toMatchObject({ designOptions: 2 });
	expect(() => runPayload({ ...create, designOptions: 12 })).toThrow('from 1 to 10');
});

test('a revised single design is changed from a thread on its approved version, as before options', () => {
	expect(() => approvalMatch(home({}), change())).not.toThrow();
	expect(() =>
		approvalMatch(home({ version: 'v002', imageSha256: hash('b') }), change())
	).not.toThrow();
	// Unchanged from before options: a thread on the version the approved one revised is refused.
	expect(() => approvalMatch(home({ version: 'v001' }), change())).toThrow(
		'from an earlier design'
	);
});

test('a Change of an approved option comes only from that option or an unanchored thread', () => {
	expect(() =>
		approvalMatch(home({ version: 'v002', option: 'o2' }, 'o2'), change('o2'))
	).not.toThrow();
	expect(() => approvalMatch(home({}, 'o2'), change('o2'))).not.toThrow();
	expect(() => approvalMatch(home({ version: 'v002', option: 'o1' }, 'o2'), change('o2'))).toThrow(
		'another design option'
	);
});

test('a Change that names another option than the approval, or none, is refused', () => {
	for (const request of [change('o1'), change()])
		expect(() => approvalMatch(home({}, 'o2'), request)).toThrow('differs from the approval');
});
