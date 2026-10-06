import type { Guide } from './guide';
export const analyticsGuide: Guide = {
	topic: 'analytics',
	summary: 'Durable local cross-project loop and Jev usage analytics.',
	steps: [
		'Import historical loops from a selected root.',
		'Query summary, loops, jev, models or events.',
		'Supply author and stable task or loop-step identity on Jev checks.',
		'Serve the bundled report website to explore Analytics.'
	],
	rules: [
		'Analytics stay local beyond report media expiry.',
		'Missing historical author and Jev attempt data remain unknown.',
		'Author model is --agent-model or HARNESS_AGENT_MODEL, separate from Jev --model.',
		'First-try rates exclude cached-only, dry-run, incomplete, unlinked and duplicate assessments.',
		'HARNESS_ANALYTICS_HOME overrides the store; HARNESS_ANALYTICS_DISABLED=1 disables recording.'
	],
	antiPatterns: [
		'Do not treat advisory exit zero as a semantic Jev pass.',
		'Do not reuse a task ID for a new task.'
	],
	exampleCommands: [
		'harness analytics import --root /Users/danielfugere/projects',
		'harness analytics jev --json',
		'harness response-check --request request.txt --response answer.txt --task answer-1 --agent-model gpt-6.1-sol',
		'harness analytics export --project /path/to/project --output analytics.html'
	]
};
export const reportGuide: Guide = {
	topic: 'report',
	summary: 'The existing Project Reports engine and media website bundled into Harness.',
	steps: [
		'Begin a feature or suite report.',
		'Record checks and evidence, including transcripts with audio.',
		'Serve the gallery and analytics locally.',
		'Finalize using packaged viewer assets; publish selected reports through existing explicit publication controls.'
	],
	rules: [
		'Existing PROJECT_REPORTS_HOME and manifests remain compatible.',
		'Use PROJECT_REPORTS_CONFIG_FILE and PROJECT_REPORTS_CLOUDFLARE_CONFIG_HOME for project-owned configuration.',
		'Media requires configured private R2 for real reports.',
		'Reports expire after 30 days; analytics history remains.',
		'PDF and ZIP exports require Python with reportlab; replay video requires ffmpeg.'
	],
	antiPatterns: [
		'Do not publish global analytics automatically.',
		'Do not confuse R2 uploads with website publication.'
	],
	exampleCommands: [
		'harness report serve',
		'harness report begin --project /path/to/project --title Delivery --mode feature --environment local',
		'harness report finalize --run RUN_ID'
	]
};
