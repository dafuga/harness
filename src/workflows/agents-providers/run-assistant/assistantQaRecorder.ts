// @harness-uid u_ra7tnn4vxj
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { ProjectAssistantError } from '../../../core/agents-providers/ProjectAssistantError';
import type { NativeRecordingSession } from '../../../services/verification-evidence/NativeVideoRecorderService.types';
import { loadChromium } from '../../../services/planning-collaboration/design-canvas-service/loadChromium';
import { NativeVideoRecorderService } from '../../../services/verification-evidence/NativeVideoRecorderService';
import type {
	AssistantQaRecipe,
	AssistantQaRecipeInput,
	PlanAssistantQaRecording
} from './assistantQaRecorder.types';

export async function assistantQaRecorder(
	root: string,
	input: AssistantQaRecipeInput,
	plan: PlanAssistantQaRecording
): Promise<string> {
	const recipe = await plan(input);
	const chromium = await loadChromium(process.cwd());
	const browser = await chromium.launch({ headless: true });
	try {
		const recorder = new NativeVideoRecorderService(join(root, 'recordings'));
		const inputHash = createHash('sha256')
			.update(JSON.stringify({ input, recipe: recipe.revision }))
			.digest('hex');
		const result = await recorder.record({
			...stagingRecipe(recipe, input.stagingUrl),
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

function stagingRecipe(recipe: AssistantQaRecipe, origin: string): AssistantQaRecipe {
	return {
		revision: recipe.revision,
		prepare: safeRecordingStep(async (session) => {
			await session.context.route('**/*', (route) => {
				const request = route.request();
				const approved = URL.parse(request.url())?.origin === origin;
				return request.isNavigationRequest() && !approved && !request.frame().parentFrame()
					? route.abort()
					: route.continue();
			});
			await recipe.prepare(session);
			requireStagingPage(session, origin);
		}),
		perform: safeRecordingStep(async (session) => {
			await recipe.perform(session);
			requireStagingPage(session, origin);
		}),
		reset: safeRecordingStep(recipe.reset)
	};
}

function requireStagingPage({ page }: NativeRecordingSession, origin: string): void {
	if (URL.parse(page.url())?.origin !== origin)
		throw new ProjectAssistantError('The QA walkthrough is outside staging.');
}

function safeRecordingStep<T>(step: (session: T) => Promise<void>) {
	return async (session: T) => {
		try {
			await step(session);
		} catch {
			// Playwright errors can carry request details from the disposable login.
			throw new ProjectAssistantError('The staging QA recipe did not complete.');
		}
	};
}
