/** Child processes use existing subscription sign-ins, never inherited API overrides. */
export function scrubEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
	return Object.fromEntries(
		Object.entries(env).filter(
			([key]) =>
				!key.startsWith('OPENAI_') &&
				!key.startsWith('ANTHROPIC_') &&
				key !== 'ELECTRON_RUN_AS_NODE'
		)
	);
}
