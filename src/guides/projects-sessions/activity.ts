import type { Guide } from '../development-tooling/guide';

export const activityGuide: Guide = {
	topic: 'activity',
	summary:
		'What a repository is doing: its recent work from Git, its checkouts, and the agents that say they are working in it.',
	steps: [
		'Run harness activity show to see loop types, recent commits with their reasons, changed files with their components, and what is not committed in each checkout.',
		'When an agent starts work, register it in its checkout: harness activity register --label "<who>" --model <model> --task "<what>" --loop <loop> --units <unit ids>. Keep the id it prints.',
		'While it works, run harness activity heartbeat <id> at each step, or export HARNESS_AGENT_ID=<id> so that every Harness command the agent runs is a heartbeat.',
		'When it ends, run harness activity finish <id> --outcome "<how it ended>", with --failed when it did not succeed.',
		'Open /harness/analytics of a running Harness to see the same, or the Activity view of a console for what a built history recorded.'
	],
	rules: [
		'An agent counts as working only while its own heartbeat is fresh: 900 seconds by default, --ttl to change it. A stale loop, a running report or a process that merely exists is not a working agent.',
		'A registration holds what its owner states and nothing else: a label, and optionally provider, model, task, loop and unit ids, each one short line. Nothing is read from a conversation, a prompt or a credential, and none belongs in these fields.',
		'--pid names a process that lives as long as the agent. When that process ends, or its number is given to another process, the agent is shown as gone whatever its heartbeat says.',
		'Registrations are kept under .cache/harness/agents of the checkout the agent works in, outside Git. Every checkout of the repository sees the agents of all its worktrees, and another repository sees none of them.',
		'Each agent writes only its own files, and each is written whole, so agents may register, beat and finish at the same time. An end is final: a later heartbeat is refused.',
		'Where no agent ever registered, the number working is unknown and is shown as unknown, not as zero. Agents that do not register are not counted.',
		'An open analytics page reads again every 15 seconds while its tab is visible, and on request. A reading it could not renew is marked; after the allowance of an agent that agent is stale, and once a reading is older than a minute nobody is counted or called working.',
		'A first view is short: five agents, five commits, six uncommitted and six committed files, a large change as counts. Everything else that was read is one control away, and what was not read is on the page of the commit.',
		'One id is one episode of one owner. Register once per episode under a new id; a second registration of the same worker counts it twice until one of them is finished.',
		'An agent that is not working stays listed for a day and its registration is removed after a week.',
		'harness history build writes activity.json beside the index: recent work, changed files, components and loop types from Git alone. It holds no checkout, agent or time of building, so an installed console shows it without Git or a database and says that live activity is not in it.',
		'A unit id that the registry does not hold is kept as stated and marked as not in the registry.'
	],
	antiPatterns: [
		'Do not register an agent from a scheduler or a wrapper that keeps beating when the agent is idle.',
		'Do not put a prompt, a secret, a path of another project or free notes into a label or a task.',
		'Do not read the roster as proof of who changed a file: uncommitted changes belong to a checkout, not to an agent.'
	],
	exampleCommands: [
		'harness activity show',
		'harness activity register --label "Claude session" --provider anthropic --model claude-opus-5-5 --task "Project analytics" --loop project-activity --units service.project-activity,service.agent-activity',
		'harness activity heartbeat <id> --task "Browser tests"',
		'HARNESS_AGENT_ID=<id> harness loop complete project-activity test --evidence "..."',
		'harness activity finish <id> --outcome "Handed over to review"',
		'harness activity agents --json'
	]
};
