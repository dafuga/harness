/* global HH */
// Default data, continued: scheduled runs, projects and work in progress.
Object.assign(HH.data.default, {
	scheduled: [
		{
			day: 'Today',
			time: '23:00',
			title: 'Nightly tracker backup',
			repeat: 'Daily',
			agent: 'Tracker keeper',
			machine: 'the box'
		},
		{
			day: 'Tomorrow',
			time: '07:30',
			title: 'Morning brief for Daniel',
			repeat: 'Every day',
			agent: 'Chief of Staff',
			machine: 'primary Mac'
		},
		{
			day: 'Tomorrow',
			time: '09:00',
			title: 'Nudge production call test',
			repeat: 'Once',
			agent: 'Grok Bot',
			machine: 'the box'
		},
		{
			day: 'Mon 23 Nov',
			time: '10:00',
			title: 'Dependency update sweep',
			repeat: 'Weekly',
			agent: 'Harness builder',
			machine: 'MB2'
		},
		{
			day: 'Mon 23 Nov',
			time: '12:00',
			title: 'Weekly cost report',
			repeat: 'Weekly',
			agent: 'Chief of Staff',
			machine: 'primary Mac'
		},
		{
			day: 'Tue 1 Dec',
			time: '09:00',
			title: 'Rotate service tokens reminder',
			repeat: 'Monthly',
			agent: 'Chief of Staff',
			machine: 'primary Mac',
			paused: true
		}
	],
	projects: [
		{
			name: 'Harness',
			apps: 3,
			pages: 48,
			components: 212,
			change: 'fix: pin the generated Rust project test toolchain',
			when: '1h',
			hash: 'dab8313'
		},
		{
			name: 'Nudge',
			apps: 2,
			pages: 14,
			components: 63,
			change: 'feat: retry outbound calls once on carrier busy',
			when: '3h',
			hash: '41c09e2'
		},
		{
			name: 'Tracker',
			apps: 2,
			pages: 3,
			components: 9,
			change: 'fix: keep spoke queues when the hub restarts',
			when: '5h',
			hash: '7f2a6b1'
		},
		{
			name: 'Chief of Staff',
			apps: 1,
			pages: 2,
			components: 11,
			change: 'chore: shorten the morning brief',
			when: 'yesterday',
			hash: 'c3e9d40'
		},
		{
			name: 'Grok box',
			apps: 1,
			pages: 0,
			components: 4,
			change: 'chore: rotate tunnel credentials',
			when: 'Thu',
			hash: '0b7718f'
		},
		{
			name: 'Website',
			apps: 1,
			pages: 6,
			components: 18,
			change: 'feat: add pricing FAQ',
			when: 'Wed',
			hash: '9ad1c55'
		}
	],
	wip: [
		{
			title: 'Approve the Nudge production window',
			project: 'Nudge',
			agent: 'Chief of Staff',
			status: 'Needs you',
			eta: 'overdue 20m',
			tone: 'overdue'
		},
		{
			title: 'Nudge real-call tests on staging',
			project: 'Nudge',
			agent: 'Grok Bot',
			status: 'In progress',
			eta: 'in 25m'
		},
		{
			title: 'Replay spoke queues after hub restart',
			project: 'Tracker',
			agent: 'Tracker keeper',
			status: 'In progress',
			eta: 'in 1h'
		},
		{
			title: 'Hub home redesign mockups',
			project: 'Harness',
			agent: 'Harness builder',
			status: 'In progress',
			eta: 'in 6h'
		},
		{
			title: 'Morning brief template refresh',
			project: 'Chief of Staff',
			agent: 'Chief of Staff',
			status: 'In progress',
			eta: 'tomorrow 07:00'
		},
		{
			title: 'Tunnel health check',
			project: 'Grok box',
			agent: 'Grok Bot',
			status: 'In progress',
			eta: 'tomorrow'
		},
		{
			title: 'Signed desktop release pipeline',
			project: 'Harness',
			agent: 'Release bot',
			status: 'Blocked',
			eta: 'Mon'
		},
		{
			title: 'Pricing FAQ copy review',
			project: 'Website',
			agent: 'Research',
			status: 'In progress',
			eta: 'Mon'
		},
		{
			title: 'Carrier busy retry',
			project: 'Nudge',
			agent: 'Grok Bot',
			status: 'In progress',
			eta: 'Tue'
		},
		{
			title: 'Tracker check command',
			project: 'Tracker',
			agent: 'Tracker keeper',
			status: 'In progress',
			eta: 'Wed'
		},
		{
			title: 'iOS paired overview checks',
			project: 'Harness',
			agent: 'Harness builder',
			status: 'In progress',
			eta: 'Thu'
		},
		{
			title: 'Billing v2 plan draft',
			project: 'Nudge',
			agent: 'Research',
			status: 'In progress',
			eta: 'no ETA'
		}
	]
});
