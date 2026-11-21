/* global HH */
// Quota: usage left on each of Daniel's subscriptions. Each limit is "% left" with its reset time;
// low is under 25% left, critical under 10%. History is % of the weekly limit used per day.
HH.quota = {};
HH.quota.claude = function (session, weekly, fable, history) {
	return {
		provider: 'Claude Code',
		plan: 'Max 20x',
		account: 'personal',
		read: 'read 2m ago',
		limits: [
			{ label: '5-hour session', left: session, reset: 'resets 01:10', note: 'in 2h 40m' },
			{ label: 'Weekly · all models', left: weekly, reset: 'resets Mon 09:00', note: 'in 2d 10h' },
			{ label: 'Weekly · Fable', left: fable, reset: 'resets Mon 09:00', note: 'in 2d 10h' }
		],
		history,
		top: [
			['Harness builder', 31],
			['Chief of Staff', 22],
			['Research', 9]
		]
	};
};
HH.quota.codex = function (session, weekly, credits, history) {
	return {
		provider: 'Codex',
		plan: 'ChatGPT Pro',
		account: 'OpenAI',
		read: 'read 4m ago',
		limits: [
			{ label: '5-hour session', left: session, reset: 'resets 23:55', note: 'in 1h 25m' },
			{ label: 'Weekly', left: weekly, reset: 'resets Tue 06:00', note: 'in 3d 7h' }
		],
		credits,
		history,
		top: [
			['Grok Bot', 41],
			['Codex reviewer', 28],
			['Tracker keeper', 13]
		]
	};
};
HH.quota.days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
HH.data.default.quota = [
	HH.quota.claude(64, 41, 72, [6, 11, 9, 14, 8, 7, 4]),
	HH.quota.codex(
		85,
		18,
		{ left: '1,240 credits', note: 'of 2,000 · renews 1 Dec' },
		[9, 16, 14, 12, 15, 11, 5]
	)
];
HH.data.busy.quota = [
	HH.quota.claude(7, 22, 14, [12, 17, 15, 9, 11, 9, 5]),
	HH.quota.codex(
		3,
		8,
		{ left: '90 credits', note: 'of 2,000 · renews 1 Dec', low: true },
		[14, 19, 18, 15, 13, 9, 4]
	),
	Object.assign(HH.quota.claude(88, 76, 90, [2, 4, 3, 5, 4, 3, 3]), {
		account: 'work',
		read: 'not read for 3h',
		stale: true
	})
];
HH.data.empty.quota = [];
