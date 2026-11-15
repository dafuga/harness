import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { expect } from 'vitest';
import type { PlannedFile } from '../../src/core/development-tooling/files';
import { findGuide } from '../../src/guides/development-tooling/guide';

/** User instructions use the installed bin; build/test setup and historical receipts stay distinct. */
export function assertHarnessCliGuidance(files: PlannedFile[]): void {
	const texts = files
		.filter((file) => /(?:AGENTS|SKILL)\.md$/.test(file.path))
		.map((file) => ({ path: `generated/${file.path}`, text: file.contents }));
	const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0');
	for (const path of paths.filter((path) => /\.mdx?$/.test(path)))
		texts.push({ path, text: readFileSync(path, 'utf8') });
	texts.push({ path: 'history guide', text: JSON.stringify(findGuide('history')) });
	const gaps: string[] = [];
	for (const { path, text } of texts)
		for (const [index, line] of text.split('\n').entries()) {
			// This is an actual past verification receipt, not a current usage recommendation.
			if (
				path === 'specification/features/implemented/model-card-flat-used-in.md' &&
				line.startsWith('- `bun run --cwd packages/reports test:unit')
			)
				continue;
			if (
				/\bbun(?: run)? (?:\S*\/)?(?:src\/(?:cli\/)?index\.ts|dist\/index\.js)\b|\bbun run dev --|\bbun run (?:report|audit)\b|\bbun run dev:reports\b/.test(
					line
				)
			)
				gaps.push(`${path}:${index + 1}: alternate Harness entry`);
			if (/`(?:contracts|units|info|activity|loop|verify|hooks|report)\s[^`]+`/.test(line))
				gaps.push(`${path}:${index + 1}: bare Harness command`);
		}
	expect(gaps, `Harness usage must start with harness:\n${gaps.slice(0, 20).join('\n')}`).toEqual(
		[]
	);
}
