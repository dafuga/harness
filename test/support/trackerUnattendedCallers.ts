import type { TrackerUnattendedCaller } from './trackerUnattendedCallers.types';

/**
 * Unattended callers of the `tracker` CLI: LaunchAgents and the scripts they run.
 * Inventoried 2026-11-27 on both Macs; the shared Linux box could not be reached.
 * Legacy calls remain here to check the fallback for scripts that still use them.
 *
 * Before changing any verb's arguments or refusals:
 * 1. Repeat the inventory on every computer (LaunchAgents, systemd units, cron, relays). Start from
 *    `launchctl list` plus `launchctl print`: some plists live outside the LaunchAgents folders.
 *    Read each job's script: a text search misses commands built from variables. Redo it at release
 *    time, because installed scripts change.
 * 2. Record new argument shapes here. Never edit a recorded shape to make a new rule pass while
 *    the installed script still sends the old one.
 * 3. A shape the new rule refuses must be `kept`, or its script must be migrated first.
 */
const primary = ['daniel-primary-mbp'] as const;
const secondary = ['harbor-mbp-2'] as const;
const both = ['daniel-primary-mbp', 'harbor-mbp-2'] as const;

const choices = [
	'--option',
	'Fix it=A session repairs the sample service.',
	'--option',
	'Watch only=The check keeps running.',
	'--recommend',
	'1'
];
const note = { args: ['note', 'ITEM', 'Sample check recovered'], outcome: 'accepted' } as const;
const show = { args: ['show', 'ITEM', '--json'], outcome: 'accepted' } as const;
const done = { args: ['done', 'ITEM', '--note', 'Recovered'], outcome: 'accepted' } as const;
const add = {
	args: ['add', 'Sample service DOWN', '--owner', 'sample-watch', '--agent', 'sample', '--json'],
	outcome: 'accepted'
} as const;
const asks = (...extra: string[]) =>
	({
		args: ['flag', 'ITEM', 'Sample check is failing', ...choices, ...extra],
		outcome: 'asks'
	}) as const;

export const trackerUnattendedCallers: readonly TrackerUnattendedCaller[] = [
	{
		caller: 'sponsor outage monitor and its watchdog',
		computers: secondary,
		calls: [
			{
				args: ['alert', 'ITEM', 'Production quote failure {"ok":false,"status":503}'],
				outcome: 'alerts'
			},
			{
				args: ['flag', 'ITEM', 'Production quote failure {"ok":false,"status":503}'],
				outcome: 'kept'
			},
			note
		]
	},
	{
		caller: 'keeper health pager',
		computers: primary,
		calls: [
			add,
			{
				args: ['alert', 'ITEM', 'RNG sample keeper failing: endpoint timed out.'],
				outcome: 'alerts'
			},
			{
				args: [
					'flag',
					'ITEM',
					'Sample keeper failing for 3 checks. Recommendation: CoS starts a fix.'
				],
				outcome: 'kept'
			},
			done
		]
	},
	{ caller: 'sponsor budget relay', computers: primary, calls: [show] },
	{ caller: 'resource alert relay', computers: primary, calls: [asks(), note] },
	{ caller: 'account coverage check', computers: primary, calls: [asks(), note] },
	{ caller: 'channel watch', computers: primary, calls: [asks('--force'), note, show] },
	{
		caller: 'provider usage-limit resume',
		computers: both,
		calls: [
			asks('--force', '--json'),
			{ args: ['note', 'ITEM', 'Sample session resumed', '--json'], outcome: 'accepted' },
			show
		]
	},
	{ caller: 'credential tunnel watchdog', computers: primary, calls: [add, note, asks(), done] },
	{
		caller: 'QA comment check',
		computers: secondary,
		calls: [
			note,
			// Despite its wording this asks Daniel: only "CoS:" openings or "for CoS" are rerouted.
			{
				args: ['flag', 'ITEM', 'For Chief of Staff (not Daniel): sample follow-up', ...choices],
				outcome: 'asks'
			}
		]
	},
	{
		caller: 'Chief of Staff status tick',
		computers: primary,
		calls: [{ args: ['list', '--flagged', '--json'], outcome: 'accepted' }]
	}
];
