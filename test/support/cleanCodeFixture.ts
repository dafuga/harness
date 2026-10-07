import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { resolveCleanCodeSettings } from '../../src/audit/cleanCodeConfig';
import type { JevEvaluation, JevRequest } from '../../src/audit/cleanCodeTypes';

export const reviewSettings = resolveCleanCodeSettings({ mode: 'advisory' });
export const greetCode = 'export function greet(name: string) { return `Hello ${name}`; }\n';

export async function reviewFixtureRoot(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), 'harness-jev-'));
	await writeReviewFixture(root, 'src/utils/greet.ts', greetCode);
	return root;
}

export async function writeReviewFixture(root: string, path: string, code: string): Promise<void> {
	await mkdir(dirname(join(root, path)), { recursive: true });
	await writeFile(join(root, path), code);
}

export function fixtureEvaluation(
	request: JevRequest,
	choice = 'meets',
	confidence = 0.97
): JevEvaluation {
	const answers = Object.fromEntries(
		Object.entries(request.questions).map(([key, question]) => {
			const options = Object.keys(question.criteria);
			const selected = options.includes(choice) ? choice : options[0];
			return [
				key,
				{
					type: 'choice' as const,
					choice: selected,
					confidence,
					probabilities: Object.fromEntries(
						options.map((option) => [option, option === selected ? 1 : 0])
					)
				}
			];
		})
	);
	return { model: 'jev-1.13.0', answers, usage: { input_tokens: 100, output_tokens: 20 } };
}
