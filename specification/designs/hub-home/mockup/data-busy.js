/* global HH */
// Busy and empty variants: the default data scaled up (long titles, an overloaded computer, many
// rows past each preview's limit) and emptied out. Loading has no data at all.
(function () {
	const base = HH.data.default;
	const extraAgents = [
		[
			'Codex reviewer',
			'working',
			'MB2',
			'Sol 6.2',
			'Reviewing PR #171: resource admission for loop fixtures across all workers'
		],
		[
			'Nudge ops',
			'needs-you',
			'the box',
			'Opus 5.5',
			'Asks: Stripe test key expired; rotate it or pause sign-up checks?'
		],
		[
			'Docs writer',
			'working',
			'primary Mac',
			'Sonnet 5.5',
			'Rewriting the self-hosting guide for Harness Hub'
		],
		['Harness iOS', 'working', 'MB2', 'Opus 5.5', 'Paired iOS acceptance run 3 of 4'],
		['Cost watcher', 'working', 'the box', 'Haiku 5.5', 'Weekly token spend by project'],
		[
			'Website bot',
			'working',
			'primary Mac',
			'Terra 6.1',
			'Pricing page screenshots at four widths'
		],
		['Tracker hub B', 'working', 'the box', 'Terra 6.1', 'Standby hub verification'],
		['Research 2', 'idle', 'primary Mac', 'Sonnet 5.5', 'Last: summarised carrier pricing'],
		['Sandbox', 'offline', 'MB2', 'Haiku 5.5', 'Last seen Thu 11:02']
	].map(([name, state, machine, model, task]) => ({
		name,
		state,
		machine,
		model,
		task,
		since: '9m'
	}));
	const morePlans = [
		'Desktop auto-update',
		'Hub audit trail',
		'Tracker mobile view',
		'Nudge voicemail',
		'Website blog',
		'Grok box backups',
		'Harness plugin API'
	].map((title, i) => ({
		title,
		project: ['Harness', 'Harness', 'Tracker', 'Nudge', 'Website', 'Grok box', 'Harness'][i],
		status: ['draft', 'active', 'review', 'draft', 'approved', 'active', 'draft'][i],
		done: i,
		steps: 8,
		updated: `${i + 2}d`
	}));
	const moreRuns = [
		'08:00 Sync spoke queues',
		'08:15 Security advisories digest',
		'09:30 Nudge call quality sample',
		'10:00 Stand-up notes',
		'13:00 Bundle size report',
		'15:00 Stale branch sweep',
		'18:00 Evening summary',
		'20:00 Website link check'
	].map((row) => ({
		day: 'Tomorrow',
		time: row.slice(0, 5),
		title: row.slice(6),
		repeat: 'Daily',
		agent: 'Chief of Staff',
		machine: 'the box'
	}));
	const moreProjects = [
		'Nudge Android',
		'Harness plugins',
		'Status page',
		'Finance',
		'Home lab'
	].map((name, i) => ({
		name,
		apps: 1,
		pages: i * 3,
		components: i * 9,
		change: 'chore: update dependencies',
		when: `${i + 2}d`,
		hash: `e1${i}9a7f`
	}));
	const longTitle = {
		title:
			'Investigate why paired iOS acceptance times out on the second pairing attempt after the hub restarts behind Cloudflare Access',
		project: 'Harness',
		agent: 'Harness iOS',
		status: 'In progress',
		eta: 'overdue 3h',
		tone: 'overdue'
	};
	const moreWip = Array.from({ length: 28 }, (_, i) => ({
		title: `Follow-up task ${i + 1}`,
		project: [
			'Harness',
			'Nudge',
			'Tracker',
			'Website',
			'Finance',
			'Status page',
			'Nudge Android',
			'Home lab',
			'Harness plugins'
		][i % 9],
		agent: extraAgents[i % 7].name,
		status: 'In progress',
		eta: `${(i % 6) + 2}d`
	}));
	HH.data.busy = {
		machines: [
			{ name: 'primary Mac', status: 'busy' },
			{ name: 'MB2', status: 'overloaded' },
			{ name: 'the box', status: 'busy' }
		],
		agents: [
			base.agents[0],
			extraAgents[1],
			...base.agents.slice(1, 4),
			...extraAgents.slice(0, 1),
			...extraAgents.slice(2),
			...base.agents.slice(4)
		],
		plans: [...base.plans, ...morePlans],
		scheduled: [base.scheduled[0], ...moreRuns, ...base.scheduled.slice(1)],
		projects: [...base.projects, ...moreProjects],
		wip: [longTitle, ...base.wip, ...moreWip]
	};
	HH.data.empty = {
		machines: base.machines,
		agents: [],
		plans: [],
		scheduled: [],
		projects: [],
		wip: []
	};
	HH.data.loading = null;
})();
