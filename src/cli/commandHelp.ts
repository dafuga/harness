// @harness-uid u_lx2pejcvnu
/** Cheap root-help metadata, checked against every actual command registration. */
export const commandHelp = [
	{
		name: 'codex',
		signature: 'codex',
		description: 'Local experimental Codex compatibility gateway.',
		term: 'codex',
		aliases: []
	},
	plainHelp('provider', 'Open the installed provider sign-in tools.'),
	plainHelp('harbor', 'Use Harbor capabilities from its installed CLI and SDK.'),
	plainHelp('benchmark', 'Compare subagents against fixed component contracts.'),
	plainHelp('resources', 'Shared CPU and memory admission for managed work.'),
	plainHelp('jobs', 'Record job durations and estimate queued work.'),
	plainHelp('analytics', 'Query durable local cross-project Harness history.'),
	{
		name: 'activity',
		signature: 'activity',
		description: 'What this repository is doing: recent work, checkouts and registered agents.',
		term: 'activity',
		aliases: []
	},
	plainHelp('projects', 'Read local Harness project cards.'),
	{
		name: 'report',
		signature: 'report [args...]',
		description: 'Record media reports and serve the website.',
		term: 'report [args...]',
		aliases: []
	},
	{
		name: 'new',
		signature: 'new',
		description: 'Create a new Harness project.',
		term: 'new',
		aliases: []
	},
	{
		name: 'generate',
		signature: 'generate',
		description: 'Generate Harness code.',
		term: 'generate|g',
		aliases: ['g']
	},
	{
		name: 'info',
		signature: 'info <topic>',
		description: 'Show static Harness guidance for adding code.',
		term: 'info [options] <topic>',
		aliases: []
	},
	{
		name: 'loop',
		signature: 'loop',
		description: 'Define and trace verifiable agent work loops.',
		term: 'loop',
		aliases: []
	},
	{
		name: 'units',
		signature: 'units',
		description: 'Maintain the unit registry: stable identities, contracts and the source graph.',
		term: 'units',
		aliases: []
	},
	{
		name: 'contracts',
		signature: 'contracts',
		description: 'Read, search, diff and trace stored contracts without opening source.',
		term: 'contracts [options]',
		aliases: []
	},
	{
		name: 'impact',
		signature: 'impact',
		description: 'Report the units, tests and scenarios a change affects, across base and head.',
		term: 'impact [options]',
		aliases: []
	},
	{
		name: 'kernel',
		signature: 'kernel',
		description: 'Prove, measure and serve the impact kernel across its runtimes.',
		term: 'kernel',
		aliases: []
	},
	{
		name: 'scenarios',
		signature: 'scenarios',
		description: 'Inspect scenario contracts: states, viewports, tests and required evidence.',
		term: 'scenarios',
		aliases: []
	},
	{
		name: 'explain',
		signature: 'explain',
		description: 'Record why each changed function or unit changed, and what was tried.',
		term: 'explain',
		aliases: []
	},
	{
		name: 'budget',
		signature: 'budget',
		description: 'Frozen size, complexity and performance limits, changed only by recorded review.',
		term: 'budget',
		aliases: []
	},
	{
		name: 'verify',
		signature: 'verify',
		description: 'Verify an exact commit in a clean snapshot and gate on its record.',
		term: 'verify',
		aliases: []
	},
	{
		name: 'task',
		signature: 'task',
		description: 'Committed module tasks, assigned workers and evidence-based completion.',
		term: 'task',
		aliases: []
	},
	{
		name: 'tracker',
		signature: 'tracker [args...]',
		description: 'Use the shared Tracker service.',
		term: 'tracker [args...]',
		aliases: []
	},
	{
		name: 'deploy',
		signature: 'deploy [project] [environment]',
		description: 'Prepare and deploy one project release with reviewed Docker scripts.',
		term: 'deploy [options] [project] [environment]',
		aliases: []
	},
	{
		name: 'module',
		signature: 'module',
		description: 'Discover and add project capabilities.',
		term: 'module',
		aliases: []
	},
	{
		name: 'plugin',
		signature: 'plugin',
		description: 'Discover external capability and testing plugins.',
		term: 'plugin',
		aliases: []
	},
	{
		name: 'api',
		signature: 'api',
		description: 'Query local or hosted Harness resources and control authorized agents.',
		term: 'api [options]',
		aliases: []
	},
	{
		name: 'permissions',
		signature: 'permissions',
		description: 'Read declared user profiles and access grants.',
		term: 'permissions [options]',
		aliases: []
	},
	{
		name: 'history',
		signature: 'history',
		description: 'Keep verification records, evidence and reasons in Git, and read them back.',
		term: 'history',
		aliases: []
	},
	{
		name: 'hooks',
		signature: 'hooks',
		description:
			'Opt-in local Git hooks: a passing verification before a push, and a short commit message.',
		term: 'hooks',
		aliases: []
	},
	{
		name: 'console',
		signature: 'console',
		description:
			'Embed the Harness console in a SvelteKit application, behind its own admin policy.',
		term: 'console',
		aliases: []
	},
	{
		name: 'audit',
		signature: 'audit [path]',
		description: 'Audit Harness rules and optionally review Clean Code principles with Jev.',
		term: 'audit [options] [path]',
		aliases: []
	},
	plainHelp(
		'design',
		'Author, list and render design canvases of HTML artboards in designs/.',
		'design [options]'
	),
	plainHelp('assistant', 'Run a Slack project assistant.', 'assistant [command]'),
	plainHelp('qa-sync', 'Sync Slack QA threads to issues.', 'qa-sync [options]'),
	plainHelp(
		'container-browser',
		'Run a private browser in a local container.',
		'container-browser [options] <action> [value]'
	),
	plainHelp('x-digest', 'Send a read-only X digest.', 'x-digest [options] [action]'),
	plainHelp(
		'response-check',
		'Check whether an LLM answer follows a user request using JEV.',
		'response-check [options]'
	)
];
function plainHelp(name: string, description: string, term = name) {
	return { name, signature: name, description, term, aliases: [] };
}
