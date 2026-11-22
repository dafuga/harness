/* global HH, window */
// Synthetic example data for the Hub home mockup. Names, tasks, hashes and times are illustrative.
window.HH = window.HH || {};
HH.data = {};
HH.data.default = {
	machines: [
		{ name: 'primary Mac', status: 'ok' },
		{ name: 'MB2', status: 'busy' },
		{ name: 'the box', status: 'ok' }
	],
	agents: [
		{
			name: 'Chief of Staff',
			state: 'needs-you',
			machine: 'primary Mac',
			model: 'Opus 5.5',
			task: 'Asks: approve the Nudge production window, Sat 09:00?',
			since: '4m'
		},
		{
			name: 'Grok Bot',
			state: 'working',
			machine: 'the box',
			model: 'Sol 6.2',
			task: 'Running Nudge real-call tests on staging',
			since: '12m'
		},
		{
			name: 'Harness builder',
			state: 'working',
			machine: 'MB2',
			model: 'Opus 5.5',
			task: 'Hub home redesign mockups',
			since: '38m'
		},
		{
			name: 'Tracker keeper',
			state: 'working',
			machine: 'the box',
			model: 'Terra 6.1',
			task: 'Replaying spoke queues after the hub restart',
			since: '1h'
		},
		{
			name: 'Research',
			state: 'idle',
			machine: 'primary Mac',
			model: 'Sonnet 5.5',
			task: 'Last: compared voice model latency',
			since: '2h'
		},
		{
			name: 'Release bot',
			state: 'offline',
			machine: 'MB2',
			model: 'Haiku 5.5',
			task: 'Last seen yesterday 18:40',
			since: '1d'
		}
	],
	plans: [
		{
			title: 'Hub home redesign',
			project: 'Harness',
			status: 'review',
			done: 2,
			steps: 5,
			updated: '20m'
		},
		{
			title: 'Tracker hub failover',
			project: 'Tracker',
			status: 'active',
			done: 5,
			steps: 7,
			updated: '1h'
		},
		{
			title: 'Signed desktop releases',
			project: 'Harness',
			status: 'approved',
			done: 4,
			steps: 9,
			updated: '3h'
		},
		{
			title: 'Nudge billing v2',
			project: 'Nudge',
			status: 'draft',
			done: 0,
			steps: 6,
			updated: 'yesterday'
		},
		{
			title: 'iOS pairing polish',
			project: 'Harness',
			status: 'done',
			done: 6,
			steps: 6,
			updated: 'Tue'
		}
	]
};
