import type {
	QaSlackMessage,
	QaSyncState
} from '../../../../src/core/agents-providers/qaSync.types';
import { QaSyncService } from '../../../../src/services/agents-providers/QaSyncService';
import { QaSyncConfigValidator } from '../../../../src/validators/agents-providers/QaSyncConfigValidator';
import type { QaSyncWorld } from './qaSyncFixture.types';

/** Message shapes copied from a real bot-posted QA thread. */
export const rawConfig = {
	project: 'demo',
	slack: { workspaceId: 'T1', channels: ['C1'] },
	github: { owner: 'acme', repo: 'app' },
	threads: { authors: ['UBOT'] },
	testers: [
		{ slackUser: 'UJESS', name: 'Jessel' },
		{ slackUser: 'UANDY', name: 'Andriy' }
	],
	retest: {
		environments: { staging: ['staging'], production: ['production', 'prod'] },
		requesters: ['UBOSS']
	},
	tracker: { agent: 'demo', inboxItem: 'inbox1' }
};

export const start = 1_800_000_000;
export const ts = (seconds: number) => `${start + seconds}.000100`;

export function parent(issue = 5, overrides: Partial<QaSlackMessage> = {}): QaSlackMessage {
	return {
		ts: ts(-500),
		user: 'UBOT',
		botId: 'BBOT',
		text: `*Staging QA · #${issue} Logo saves*\n• <https://github.com/acme/app/issues/${issue}|Issue #${issue}> · <https://github.com/acme/app/pull/9|Fix PR #9>`,
		...overrides
	};
}

export const mark = (...users: string[]) => [
	{ name: 'white_check_mark', count: users.length, users }
];

export function world(): QaSyncWorld {
	const value: QaSyncWorld = {
		parents: [parent()],
		replies: [],
		labels: new Map([[5, ['bug']]]),
		items: [],
		notes: [],
		failNotes: false,
		clock: start,
		state: undefined
	};
	return value;
}

export function reply(w: QaSyncWorld, seconds: number, text: string, user = 'UJESS'): void {
	w.replies.push({ ts: ts(seconds), text, user });
	w.parents[0] = { ...w.parents[0], replyCount: w.replies.length, latestReply: ts(seconds) };
}

const copy = (state: QaSyncState): QaSyncState => JSON.parse(JSON.stringify(state));

export function service(w: QaSyncWorld): QaSyncService {
	return new QaSyncService(new QaSyncConfigValidator().parse(rawConfig), {
		now: () => w.clock * 1000,
		slack: {
			identity: async () => ({ workspaceUrl: 'https://demo.slack.com/' }),
			history: async () => w.parents,
			replies: async () => [w.parents[0], ...w.replies]
		},
		github: {
			labels: async (issue) => w.labels.get(issue),
			addLabel: async (issue, label) => void w.labels.get(issue)?.push(label)
		},
		tracker: {
			openItems: async () => w.items,
			note: async (id, text) => {
				if (w.failNotes) throw new Error('tracker down');
				w.notes.push({ id, text });
			}
		},
		state: {
			load: async () => w.state && copy(w.state),
			save: async (state: QaSyncState) => {
				w.state = copy(state);
			}
		}
	});
}
