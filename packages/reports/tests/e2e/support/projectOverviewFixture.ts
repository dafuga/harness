import type {
	OverviewCard,
	OverviewItem,
	OverviewSnapshot
} from '../../../src/lib/projects-sessions/project-overview/projectOverview.types';

/** The pinned clock of every Project Overview run, in milliseconds (2026-11-20 20:41, Lisbon). */
export const NOW = Date.parse('2026-11-20T20:41:00+01:00');

const hoursBefore = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();
const daysAfter = (days: number) => new Date(NOW + days * 86_400_000).toISOString();
const daysBefore = (days: number) => new Date(NOW - days * 86_400_000).toISOString();

const LONG_TITLE =
	'Reconcile the synthetic ledger export with the archived quarterly totals, including every rounding rule that the older reconciliation script applied to multi-currency rows before the cut-over, and record each difference with its reason';

function item(
	id: string,
	title: string,
	status: OverviewItem['status'],
	extra: Partial<OverviewItem> = {}
): OverviewItem {
	return {
		id,
		title,
		status,
		updatedAt: hoursBefore(3),
		due: null,
		live: false,
		stale: false,
		...extra
	};
}

function card(
	agent: string,
	partial: Partial<OverviewCard> & Pick<OverviewCard, 'state'>
): OverviewCard {
	return {
		agent,
		liveSessions: 0,
		counts: { open: 0, in_progress: 0, blocked: 0, done: 0 },
		items: [],
		attention: null,
		blocked: null,
		milestone: null,
		updatedAt: hoursBefore(1),
		...partial
	};
}

const attentionItem = item('ITEM-A1', 'Choose the export column names', 'open', {
	updatedAt: hoursBefore(2)
});
const blockedItem = item('ITEM-B2', 'Sign the packaged build', 'blocked', {
	updatedAt: hoursBefore(5)
});
const liveItem = item('ITEM-A2', 'Draft the pricing rules', 'in_progress', {
	live: true,
	due: daysAfter(4)
});

const projects = [
	card('Atlas', {
		state: 'needs-you',
		liveSessions: 1,
		counts: { open: 1, in_progress: 1, blocked: 1, done: 3 },
		items: [
			liveItem,
			item('ITEM-A3', 'Check the overdue reconciliation', 'in_progress', {
				due: daysBefore(2)
			}),
			attentionItem
		],
		attention: {
			item: attentionItem,
			text: 'Should the export keep the old column names for existing readers?'
		},
		blocked: { item: blockedItem, text: 'Waiting on a signing key from the platform team' },
		milestone: { text: 'Finished the shared rounding rules.', at: hoursBefore(6) },
		updatedAt: hoursBefore(1)
	}),
	card('Beacon', {
		state: 'blocked',
		counts: { open: 0, in_progress: 0, blocked: 1, done: 2 },
		items: [blockedItem],
		blocked: { item: blockedItem, text: 'Waiting on a signing key from the platform team' },
		milestone: { text: 'Packaged the preview build.', at: daysBefore(1) }
	}),
	card('Cinder', {
		state: 'active',
		liveSessions: 2,
		counts: { open: 0, in_progress: 2, blocked: 2, done: 1 },
		items: [
			item('ITEM-C1', LONG_TITLE, 'in_progress', { live: true, due: daysAfter(1) }),
			item('ITEM-C2', 'Tidy the retry notes', 'in_progress', {
				due: null,
				stale: true,
				updatedAt: daysBefore(3)
			}),
			item('ITEM-C3', 'Write the upstream timeout test', 'in_progress', { due: daysAfter(6) })
		],
		blocked: { item: blockedItem, text: 'Upstream API quota reached' },
		milestone: { text: 'Merged the retry handling.', at: hoursBefore(2) },
		updatedAt: hoursBefore(0.5)
	}),
	card('Delta', {
		state: 'quiet',
		counts: { open: 2, in_progress: 1, blocked: 0, done: 4 },
		items: [
			item('ITEM-D1', 'Sketch the onboarding checklist', 'in_progress', {
				stale: true,
				updatedAt: daysBefore(3)
			})
		],
		milestone: { text: 'Drafted the onboarding notes.', at: daysBefore(3) },
		updatedAt: daysBefore(3)
	}),
	card('Ember', {
		state: 'done',
		counts: { open: 0, in_progress: 0, blocked: 0, done: 5 },
		milestone: { text: 'Shipped the handover notes.', at: daysBefore(2) },
		updatedAt: daysBefore(2)
	})
];

/** One project in every state, with each part of a card the approved design shows. */
export function allStatesSnapshot(): OverviewSnapshot {
	return {
		status: 'ready',
		liveSessions: 3,
		machines: [
			{ name: 'Primary Mac', status: 'overloaded' },
			{ name: 'Box', status: 'busy' },
			{ name: 'MB2', status: 'offline' }
		],
		projects: structuredClone(projects)
	};
}

/** A ready tracker with no projects, which is an answer and not a failure. */
export function emptyReadySnapshot(): OverviewSnapshot {
	return { status: 'ready', projects: [], machines: [], liveSessions: 0 };
}

/** A tracker that cannot be reached from this host. */
export function unavailableSnapshot(): OverviewSnapshot {
	return { status: 'unavailable' };
}

/** Only quiet and done projects, so a filter with no match is reachable. */
export function quietOnlySnapshot(): OverviewSnapshot {
	const all = allStatesSnapshot();
	return { ...all, projects: all.projects.filter((project) => project.state === 'quiet') };
}
