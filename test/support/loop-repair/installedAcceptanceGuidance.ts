import { expect } from 'vitest';
import { runHarness } from '../cli';

export async function expectInstalledAcceptanceGuidance(project: string): Promise<void> {
	const guide = await runHarness(['info', 'feature'], project);
	expect(guide.stdout).toContain('expected approval and host');
	expect(guide.stdout).toContain('attach one versioned proof record');
	expect(guide.stdout).toContain('Keep any incomplete installed-path milestone blocked');
}
