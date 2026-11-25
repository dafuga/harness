/** Synthetic tracker item rows only. No test reads the real tracker or its item bodies. */
import type { ItemFields, ItemFlags } from './project-overview-item-fixtures.types';

/** A credential-shaped value placed in a note; it must never reach the snapshot. */
export const SECRET_NOTE_TOKEN = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';

/** A tracker item row from its fields, then the optional due date, notes and extra fields the overview reads. */
export function item(fields: ItemFields, flags: ItemFlags = {}): Record<string, unknown> {
	return {
		id: fields.id,
		title: fields.title,
		status: fields.status,
		updated_at: fields.updated,
		due: flags.due ?? null,
		agent: fields.agent,
		...(flags.notes ? { notes_log: flags.notes } : {}),
		...flags.extra
	};
}

/** A row from positional fields, so the fixture tables stay compact and readable. */
function row(
	[agent, id, status, title, updated]: [string | null, string, string, string, string],
	flags: ItemFlags = {}
): Record<string, unknown> {
	return item({ agent, id, status, title, updated }, flags);
}

/** A callback target and a note carrying a credential-shaped token; neither may reach a snapshot. */
const CALLBACK = { target: 'https://example.invalid/hook?token=abc', node: 'box' };
const SECRET_NOTE = [
	{ at: '2026-11-20T19:41:00.000Z', node: 'box', text: `Checked CI with ${SECRET_NOTE_TOKEN}` }
];

/** Open, in-progress and blocked rows for the first projects. */
function alphaBetaRows(): Record<string, unknown>[] {
	return [
		row(['alpha-app', 'a1', 'open', 'Choose billing provider', '2026-11-20T18:41:00.000Z'], {
			notes: SECRET_NOTE,
			extra: {
				callback: CALLBACK,
				needs_daniel: true,
				resolved: false,
				question: 'Pick Stripe or Paddle?'
			}
		}),
		row(['alpha-app', 'a2', 'in_progress', 'Migrate invoices', '2026-11-19T14:41:00.000Z']),
		row(['beta-site', 'b1', 'blocked', 'Connect domain', '2026-11-20T15:41:00.000Z'], {
			extra: { blocked_reason: 'Waiting on DNS from registrar' }
		}),
		row(['beta-site', 'b2', 'blocked', 'Buy certificate', '2026-11-20T10:41:00.000Z'], {
			extra: { blocked_reason: 'Old reason: budget' }
		})
	];
}

/** Gamma and delta rows, including a blocked item with a live session elsewhere. */
function gammaDeltaRows(): Record<string, unknown>[] {
	return [
		row(['gamma-api', 'g1', 'in_progress', 'Rate limit middleware', '2026-11-19T04:41:00.000Z'], {
			due: '2026-11-21T12:00:00.000Z',
			notes: [{ at: '2026-11-20T20:11:00.000Z', node: 'box', text: 'Wrote tests' }]
		}),
		row(['gamma-api', 'g2', 'blocked', 'Vendor access', '2026-11-20T17:41:00.000Z'], {
			extra: { blocked_reason: 'Needs API key from vendor' }
		}),
		row(['delta-docs', 'd1', 'in_progress', 'Write onboarding guide', '2026-11-20T18:41:00.000Z'])
	];
}

/** Delta and epsilon rows: a due in-progress item, a shipped item and an open item. */
function deltaEpsilonRows(): Record<string, unknown>[] {
	return [
		row(['delta-docs', 'd3', 'in_progress', 'Pick theme', '2026-11-20T16:41:00.000Z'], {
			due: '2026-11-23T10:00:00.000Z'
		}),
		row(['delta-docs', 'd2', 'done', 'Shipped onboarding', '2026-11-20T00:41:00.000Z'], {
			notes: [{ at: '2026-11-20T00:41:00.000Z', node: 'primary', text: 'Shipped onboarding' }]
		}),
		row(['epsilon-ops', 'e1', 'in_progress', 'Rotate logs', '2026-11-19T14:41:00.000Z'], {
			due: '2026-11-18T09:00:00.000Z'
		}),
		row(['epsilon-ops', 'e2', 'open', 'Archive old backups', '2026-11-20T10:41:00.000Z'])
	];
}

/** Boundary rows: new work, the exact 24-hour and 7-day edges, and the first clear-cut states. */
function boundaryRows(): Record<string, unknown>[] {
	return [
		row(['zeta-new', 'z1', 'open', 'Scope new idea', '2026-11-20T19:41:00.000Z']),
		row(['eta-edge-active', 'x1', 'in_progress', 'Boundary active', '2026-11-19T20:41:00.000Z']),
		row(['theta-edge-quiet', 'y1', 'in_progress', 'Boundary quiet', '2026-11-19T20:40:59.000Z']),
		row(['kappa-done', 'k1', 'done', 'Shipped invoices', '2026-11-17T20:41:00.000Z']),
		row(['lambda-done-edge', 'l1', 'done', 'Shipped on the edge', '2026-11-13T20:41:00.000Z']),
		row(['mu-old-done', 'm1', 'done', 'Shipped long ago', '2026-11-13T20:40:59.000Z'])
	];
}

/** Sensitive, deleted and ignored rows, and an unowned row; none of them may reach a card. */
function hiddenRows(): Record<string, unknown>[] {
	return [
		row(['nu-hidden', 'n1', 'in_progress', 'Private draft', '2026-11-20T19:41:00.000Z'], {
			extra: { sensitive: true }
		}),
		row(['nu-hidden', 'n2', 'blocked', 'Deleted plan', '2026-11-20T19:41:00.000Z'], {
			extra: { deleted: true, blocked_reason: 'secret thing' }
		}),
		row(['xi-ignored', 'xi1', 'ignored', 'Dropped idea', '2026-11-20T19:41:00.000Z'], {
			extra: { blocked_reason: null }
		}),
		row(['xi-ignored', 'xi2', 'open', 'Real idea', '2026-11-20T15:41:00.000Z']),
		row([null, 'orphan', 'blocked', 'No project', '2026-11-20T19:00:00.000Z'], {
			extra: { blocked_reason: 'no owner' }
		})
	];
}

/** Item rows, including a callback, deleted, sensitive, ignored and unowned records. */
export function syntheticItems(): Record<string, unknown>[] {
	return [
		...alphaBetaRows(),
		...gammaDeltaRows(),
		...deltaEpsilonRows(),
		...boundaryRows(),
		...hiddenRows()
	];
}
