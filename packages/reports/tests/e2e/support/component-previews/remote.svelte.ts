import type { PreviewCases } from './shared';
import { stamp, done, previewAnswerOptions } from './shared';
import { phoneTrackerInboxSource } from '../../../../../desktop/src/lib/development-tooling/tracker-inbox/phoneTrackerInboxSource';
import { writeView } from '../../../../../desktop/src/lib/development-tooling/tracker-inbox/trackerInbox';
import type { PhoneTrackerTools } from '../../../../../desktop/src/models/development-tooling/PhoneTracker.types';
import type {
	InboxDetail,
	InboxWrite
} from '../../../../../desktop/src/models/development-tooling/TrackerInbox.types';
const projects = [{ id: 'preview-project', name: 'Northstar Store' }];
const request = {
	pairingId: 'preview-request',
	deviceId: '7c4a8d09e1b2f6a35d08c94716fe2b809ab6c5d483e17f902a3dc64e58b7190f',
	deviceName: 'Ada’s iPhone',
	platform: 'iOS',
	requestedAt: stamp,
	expiresAt: '2026-10-20T10:05:05Z'
};
const devices = [
	{
		deviceId: 'preview-device',
		name: 'Ada’s iPhone',
		platform: 'iOS',
		projectIds: ['preview-project'],
		comments: true,
		agents: false,
		approvedAt: stamp,
		lastSeenAt: stamp,
		online: true
	}
];
export function remotePreview() {
	const host = $state({
		busy: false,
		error: '',
		status: {
			supported: true,
			enabled: true,
			state: 'online',
			reason: null,
			host: { id: 'preview-computer', name: 'Ada’s Mac' },
			origin: 'https://preview.invalid',
			requests: [],
			devices,
			projects
		},
		enable: done,
		disable: done,
		approve: done,
		deny: done,
		revoke: done
	});
	const phone = $state({
		busy: false,
		error: '',
		fixture: false,
		status: {
			state: 'online',
			origin: 'https://preview.invalid',
			host: { id: 'preview-computer', name: 'Ada’s Mac' },
			device: { id: 'preview-device', name: 'Ada’s iPhone' },
			grant: { projects: ['preview-project'], agents: false, comments: true },
			reason: null,
			lastOnlineAt: stamp
		},
		scan: done,
		disconnect: done
	});
	const cases: PreviewCases = {
		...trackerInboxCases(),
		'desktop.component.remote-approval': {
			request,
			projects: [{ id: 'northstar-store', name: 'Northstar Store' }],
			store: host
		},
		'desktop.component.remote-devices': { devices, projects, store: host },
		'desktop.component.remote-host-panel': { store: host },
		'desktop.component.remote-phone-panel': { store: phone }
	};
	return { host, phone, cases };
}

const trackerItem = {
	id: 'preview-item',
	title: 'Review the storefront',
	project: 'Northstar Store',
	status: 'in_progress',
	updatedAt: stamp,
	dueAt: null
};
const trackerReminders = [
	{
		...trackerItem,
		id: 'preview-reminder',
		title: 'Water the sample plant',
		status: 'open',
		reminder: { at: stamp, repeats: 'Weekly' }
	}
];
const trackerDetail: InboxDetail = {
	header: trackerItem,
	flag: { state: 'open', at: stamp, question: 'Is this ready for review?' },
	notes: [{ id: 'preview-note', author: 'Ada', at: stamp, text: 'The preview is ready.' }],
	runs: [
		{
			id: 'preview-run',
			origin: 'Mac',
			state: 'finished',
			outcome: 'passed',
			queuedAt: null,
			startedAt: null,
			endedAt: null
		}
	],
	revision: 'preview-revision'
};
const trackerWrites: InboxWrite[] = [
	{ intentId: 'preview-pending', itemId: trackerItem.id, status: 'queued', reason: '' },
	{ intentId: 'preview-accepted', itemId: trackerItem.id, status: 'accepted', reason: '' },
	{
		intentId: 'preview-conflict',
		itemId: trackerItem.id,
		status: 'conflict',
		reason: 'attention'
	},
	{ intentId: 'preview-rejected', itemId: trackerItem.id, status: 'conflict', reason: 'denied' }
];
const trackerReplies = {
	tracker_status: { needsYou: [trackerItem], recent: [trackerItem], unresolvedFlags: 1 },
	tracker_show: { ...trackerDetail, item: trackerItem, attentionRevision: trackerDetail.revision },
	tracker_write_status: { writes: trackerWrites },
	tracker_search: { items: [trackerItem] }
};

const trackerNoop = async () => {};

export const previewTracker: PhoneTrackerTools = {
	schemas: [],
	refresh: trackerNoop,
	call: async (name) => ({
		source: 'local_tracker',
		freshness: 'current',
		lastSyncedAt: null,
		partial: false,
		data: trackerReplies[name as keyof typeof trackerReplies]
	})
};

function trackerInboxCases(): PreviewCases {
	const source = phoneTrackerInboxSource(previewTracker);
	const answerable = {
		...trackerDetail,
		flag: { ...trackerDetail.flag, options: previewAnswerOptions }
	};
	const unit = 'desktop.component.development-tooling-tracker-inbox-tracker-inbox';
	return {
		[unit]: { source },
		[`${unit}-choices`]: {
			flag: { ...trackerDetail.flag, options: previewAnswerOptions },
			onpick: trackerNoop
		},
		[`${unit}-detail`]: { source, id: trackerItem.id, onchanged: trackerNoop },
		[`${unit}-record`]: { detail: trackerDetail },
		[`${unit}-reminders`]: {
			source,
			mode: 'phone',
			reminders: trackerReminders,
			onchanged: trackerNoop,
			onnotice: trackerNoop,
			onselect: trackerNoop
		},
		[`${unit}-rows`]: {
			source,
			mode: 'phone',
			onchanged: trackerNoop,
			onnotice: trackerNoop,
			rows: [{ header: trackerItem, bucket: 'needs-you', review: answerable }],
			selected: null,
			label: 'Needs you',
			empty: 'Nothing here right now.',
			onselect: trackerNoop
		},
		[`${unit}-writes`]: { source, writes: trackerWrites.map(writeView), onchanged: trackerNoop },
		'desktop.page.tracker': {}
	};
}
