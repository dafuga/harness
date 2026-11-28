// Sample content for the board designs. Every project, task, agent, number and time is made up.

export const projects = [
	{ name: 'All projects', open: 17, pressed: true },
	{ name: 'Harness', open: 8 },
	{ name: 'Notes app', open: 5 },
	{ name: 'Shop site', open: 4 }
];

export const computers = [
	{
		name: 'Primary Mac',
		tone: 'done',
		state: 'Healthy',
		load: 62,
		sub: '4 sessions · 62% load',
		short: '62% load'
	},
	{
		name: 'MacBook 2',
		tone: 'warn',
		state: 'High load',
		load: 91,
		sub: '3 sessions · 91% load',
		short: '91% load'
	},
	{
		name: 'Box',
		tone: 'blocked',
		mark: 'blocked',
		state: 'Offline',
		load: 0,
		sub: 'Last seen 16:40',
		short: 'Offline'
	}
];

export const quota = [
	{ name: 'Claude', window: '5 hour', left: 64, resets: 'resets 21:10' },
	{ name: 'Codex', window: 'weekly', left: 22, resets: 'resets Mon' }
];

const todo = [
	{
		project: 'Harness',
		title: 'Show the design canvas on iPhone',
		when: 'Queued #1',
		tags: ['Sol 6.2', 'MacBook 2']
	},
	{
		project: 'Harness',
		title: 'Search across task notes',
		when: 'Queued #2',
		tags: ['Opus 5.5', 'Primary Mac']
	},
	{
		project: 'Notes app',
		title: 'Offline drafts sync when the phone reconnects',
		when: 'Due today 18:00',
		tags: ['Fable 5.2']
	},
	{ project: 'Shop site', title: 'Gift card balance on the checkout page', note: 'Not scheduled' },
	{ project: 'Notes app', title: 'Share a note as a read-only link', note: 'Not scheduled' },
	{ project: 'Harness', title: 'Weekly quota report by project', note: 'Not scheduled' },
	{ project: 'Shop site', title: 'Saved addresses at checkout', note: 'Not scheduled' }
];

const active = [
	{
		project: 'Harness',
		title: 'Board view as the Hub home page',
		when: 'ETA 19:40',
		tags: ['Fable 5.2', 'Primary Mac']
	},
	{
		project: 'Harness',
		title: 'Realtime inbox on iPhone',
		when: 'ETA 20:15',
		tags: ['Sol 6.2', 'MacBook 2']
	},
	{
		project: 'Notes app',
		title: 'Notification service: delivery retries',
		when: 'ETA 18:50',
		tags: ['Opus 5.5', 'Primary Mac']
	},
	{
		project: 'Shop site',
		title: 'Checkout tests in mock mode',
		when: 'ETA 19:05',
		tags: ['Terra 6.1', 'MacBook 2']
	},
	{
		project: 'Harness',
		title: 'Release check for the weekly release',
		when: 'ETA 18:30',
		tags: ['Sonnet 5.5', 'Primary Mac']
	}
];

const blocked = [
	{
		kind: 'needs',
		project: 'Harness',
		title: 'Design canvas viewer',
		line: 'Which layout should it open with?',
		when: 'waiting 2h 14m'
	},
	{
		kind: 'needs',
		project: 'Notes app',
		title: 'Notification service build',
		line: 'Approve the spec before building?',
		when: 'waiting 46m'
	},
	{
		kind: 'needs',
		project: 'Shop site',
		title: 'Live checkout tests',
		line: 'Spend up to $5 on live tests today?',
		when: 'waiting 12m'
	},
	{
		project: 'Harness',
		title: 'iPhone app update 1.8',
		line: 'Waiting on App Store review',
		when: 'since Thu'
	},
	{
		project: 'Notes app',
		title: 'Import from the old notes export',
		line: 'Waiting on: Offline drafts sync',
		when: 'since 14:20'
	}
];

const done = [
	{
		project: 'Harness',
		title: 'Header quota pills show Claude and Codex',
		when: '16:05',
		pr: 'PR #452'
	},
	{ project: 'Shop site', title: 'Order confirmation email', when: '14:32', pr: 'PR #88' },
	{
		project: 'Harness',
		title: 'Share device rows between Hub and Mac',
		when: '13:10',
		pr: 'PR #472'
	},
	{ project: 'Notes app', title: 'Dark mode for the editor', when: '11:47', pr: 'PR #131' },
	{ project: 'Harness', title: 'Digest delivery proof', when: 'Yesterday', pr: 'PR #447' },
	{ project: 'Shop site', title: 'Faster product search', when: 'Yesterday', pr: 'PR #86' }
];

const kind = (k, list) => list.map((card) => ({ kind: k, ...card }));

export const columns = [
	{
		key: 'todo',
		title: 'To do',
		short: 'To do',
		tone: 'quiet',
		count: 7,
		limit: 4,
		cards: kind('todo', todo),
		more: 'Show 3 more'
	},
	{
		key: 'active',
		title: 'In progress',
		short: 'In progress',
		tone: 'active',
		count: 5,
		cards: kind('active', active)
	},
	{
		key: 'blocked',
		title: 'Blocked',
		short: 'Blocked',
		tone: 'blocked',
		count: 5,
		needs: 3,
		cards: kind('blocked', blocked)
	},
	{
		key: 'done',
		title: 'Done',
		short: 'Done',
		tone: 'done',
		count: 14,
		note: 'this week',
		limit: 5,
		cards: kind('done', done),
		more: 'Show 9 more from this week'
	}
];
