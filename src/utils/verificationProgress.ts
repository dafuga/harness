/** Opt-in diagnostic events go to stderr, leaving machine-readable records on stdout. */
export function verificationProgress(
	env: Record<string, string | undefined>,
	event: { phase: string; status: string; id?: string; durationMs?: number; checks?: number }
): void {
	if (env.HARNESS_VERIFY_PROGRESS !== '1') return;
	process.stderr.write(
		`[harness verify] ${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`
	);
}
