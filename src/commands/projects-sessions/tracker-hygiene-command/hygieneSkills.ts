// @harness-uid u_5cak6jbcpm
// Bun embeds both canonical skill documents in the compiled CLI.
// @ts-expect-error Bun text import, embedded by the CLI bundler.
import computerHygiene from '../../../../.codex/skills/computer-hygiene/SKILL.md' with { type: 'text' };
// @ts-expect-error Bun text import, embedded by the CLI bundler.
import designPatterns from '../../../../.codex/skills/design-patterns/SKILL.md' with { type: 'text' };
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const hygieneSkills = {
	'computer-hygiene': computerHygiene,
	'design-patterns': designPatterns
};

export function installHygieneSkills() {
	const profiles = new Set([
		process.env.CODEX_HOME ?? join(homedir(), '.codex'),
		process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')
	]);
	for (const profile of profiles)
		for (const [name, text] of Object.entries(hygieneSkills))
			writeSkill(join(profile, 'skills', name), text);
}

function writeSkill(directory: string, text: string) {
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	const destination = join(directory, 'SKILL.md');
	try {
		if (readFileSync(destination, 'utf8') === text) return;
	} catch (error) {
		if ((error as { code?: string }).code !== 'ENOENT') throw error;
	}
	const temporary = join(directory, '.skill-' + randomUUID());
	try {
		writeFileSync(temporary, text, { mode: 0o600, flag: 'wx' });
		renameSync(temporary, destination);
	} finally {
		rmSync(temporary, { force: true });
	}
}
