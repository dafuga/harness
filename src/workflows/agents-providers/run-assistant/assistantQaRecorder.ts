import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { NativeVideoRecorderService } from '../../../services/verification-evidence/NativeVideoRecorderService';
import type { AssistantQaRecipeInput, PlanAssistantQaRecording } from './assistantQaRecorder.types';

export async function assistantQaRecorder(
	root: string,
	input: AssistantQaRecipeInput,
	plan: PlanAssistantQaRecording
): Promise<string> {
	const recipe = await plan(input);
	const browser = await chromium.launch({ headless: true });
	try {
		const recorder = new NativeVideoRecorderService(join(root, 'recordings'));
		const inputHash = createHash('sha256')
			.update(JSON.stringify({ input, recipe: recipe.revision }))
			.digest('hex');
		const result = await recorder.record({
			...recipe,
			browser,
			inputHash,
			viewport: { width: 1280, height: 800 },
			testedRevision: input.deployedRevision,
			slotKey: `staging-qa-${input.task.issue}`,
			diagnostics: { watch() {}, async finish() {} }
		});
		return result.video.path;
	} finally {
		await browser.close();
	}
}
