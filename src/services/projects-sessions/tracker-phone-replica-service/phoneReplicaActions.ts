// @harness-uid u_xhueog5n2u
import type { PhoneReplicaAction } from './phoneReplicaActions.types';

export type { PhoneReplicaAction } from './phoneReplicaActions.types';

/**
 * Each phone action carries one text field. It becomes the planner's body field for that action.
 * `required` actions reject empty text; the others may send '' and change state without a note.
 */
export const phoneReplicaActions: Readonly<
	Record<PhoneReplicaAction, { field: string; required: boolean }>
> = {
	note: { field: 'text', required: true },
	flag: { field: 'question', required: true },
	answer: { field: 'answer', required: true },
	block: { field: 'reason', required: true },
	ignore: { field: 'reason', required: true },
	start: { field: 'note', required: false },
	reopen: { field: 'note', required: false },
	unblock: { field: 'note', required: false },
	done: { field: 'note', required: false },
	unignore: { field: 'note', required: false },
	remind: { field: 'at', required: true },
	resolve: { field: 'answer', required: false }
};

/** Actions that only apply while the item is waiting for Daniel's answer. */
export const needsOpenFlag: ReadonlySet<PhoneReplicaAction> = new Set(['answer', 'resolve']);

/**
 * Lifecycle actions name the item status the phone was showing. The attention revision does not
 * cover status, so a stale view must be refused by this expectation instead.
 */
export const statusGuarded: ReadonlySet<PhoneReplicaAction> = new Set([
	'start',
	'reopen',
	'block',
	'unblock',
	'resolve',
	'done',
	'remind',
	'ignore',
	'unignore'
]);

export function isPhoneReplicaAction(value: unknown): value is PhoneReplicaAction {
	return typeof value === 'string' && Object.hasOwn(phoneReplicaActions, value);
}
