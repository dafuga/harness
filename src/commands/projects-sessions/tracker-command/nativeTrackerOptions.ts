// @harness-uid u_r7qgepnoax
const text = { type: 'string' } as const;
const flag = { type: 'boolean' } as const;
export const nativeTrackerCommonOptions = { json: flag, quiet: { ...flag, short: 'q' }, by: text };
const launchOptions = { project: text, repo: text, computer: text, model: text, sensitive: flag };
const itemOptions = {
	...launchOptions,
	kind: text,
	due: text,
	owner: text,
	agent: text,
	notes: text,
	parent: text,
	question: text,
	title: text,
	status: text,
	'callback-url': text,
	'callback-cmd': text,
	'needs-daniel': flag,
	auto: flag,
	every: text,
	tz: text,
	force: flag
};
export const nativeTrackerCommandOptions = new Map<
	string,
	Record<string, typeof text | typeof flag>
>([
	['add', itemOptions],
	['plan', itemOptions],
	['goal', itemOptions],
	['update', { ...itemOptions, note: text }],
	['note', {}],
	['progress', {}],
	['flag', { question: text, force: flag }],
	['block', { 'needs-daniel': flag, force: flag }],
	['unblock', { note: text }],
	['answer', { done: flag }],
	['resolve', { done: flag }],
	['done', { note: text, failed: flag, occurrence: text }],
	['launch', launchOptions],
	['unlaunch', {}],
	['show', {}],
	[
		'list',
		{
			status: text,
			kind: text,
			agent: text,
			owner: text,
			parent: text,
			flagged: flag,
			recurring: flag,
			limit: text
		}
	],
	['check', { agent: text }],
	['history', { limit: text }],
	['runs', { item: text, limit: text }],
	['models', {}],
	['pick', {}],
	['start', {}],
	['reopen', {}],
	['unflag', {}],
	['rm', {}],
	['status', {}],
	['digest', {}],
	['sync', {}],
	['watchdog', { item: text }],
	['ensure', {}]
]);
