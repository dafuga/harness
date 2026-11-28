// @harness-uid u_bbfpbxpahq
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { SlackAdapterConfig } from '../../adapters/agents-providers/SlackAdapter.types';
import { SlackAdapter } from '../../adapters/agents-providers/SlackAdapter';
import { AssistantSlackMediaAdapter } from '../../adapters/agents-providers/AssistantSlackMediaAdapter';
import { TrackerNoteAdapter } from '../../adapters/agents-providers/TrackerNoteAdapter';
import {
	ClaudeMessagesAdapter,
	GitHubAppAdapter,
	HealthProbeAdapter,
	ProjectAssistantService,
	TrackerCliAdapter,
	assistantTools
} from '../../lib/agents-providers/projectAssistant';
import { QaSyncStateRepository } from '../../repositories/agents-providers/QaSyncStateRepository';
import { SlackAssistantService } from '../../services/agents-providers/SlackAssistantService';
import type { AssistantCommandOptions } from '../../commands/agents-providers/AssistantCommand.types';
import { assistantCredential } from './run-assistant/assistantCredential';
import { assistantCanvas } from './run-assistant/assistantCanvas';
import { readAssistantConfig } from './run-assistant/readAssistantConfig';
import type { PlanAssistantQaRecording } from './run-assistant/assistantQaRecorder.types';
import { assistantSlackTools } from './run-assistant/assistantSlackTools';
import { ProjectAssistantError } from '../../core/agents-providers/ProjectAssistantError';

export async function runAssistant(input: AssistantCommandOptions): Promise<void> {
	const settings = await readAssistantConfig(input.config);
	const config = settings.assistant;
	const runtime = createRuntime(input, settings);
	await runtime.slack.identity();
	const plan = await qaRecipe(input);
	if (plan && !settings.qa) throw new ProjectAssistantError('QA configuration is required.');
	const root = join(homedir(), '.harness', 'assistant', config.project);
	const lock = new QaSyncStateRepository(join(root, 'assistant.json'));
	await lock.exclusive(async () => {
		const { github, model, slack, media, trackerRun } = runtime;
		const tracker = new TrackerCliAdapter({ ...config.tracker, run: trackerRun });
		const canvas =
			settings.canvas && assistantCanvas(settings.canvas, github, media, join(root, 'canvas.json'));
		const service = new SlackAssistantService({
			slack,
			assistant: new ProjectAssistantService({
				config,
				model,
				tools: assistantTools(github, tracker, new HealthProbeAdapter(config.health)),
				requestTools: assistantSlackTools(settings, media, canvas?.loadState)
			}),
			botUserId: settings.slack.botUserId,
			report: (code) => console.error(code)
		});
		const qa =
			settings.qa && plan && input.qaSince
				? await qaPass(root, { ...runtime, settings, plan, since: input.qaSince })
				: undefined;
		await runUntilStopped(service, canvas && (() => canvas.service.sync()), qa);
	});
}

function createRuntime(
	input: AssistantCommandOptions,
	settings: Awaited<ReturnType<typeof readAssistantConfig>>
) {
	const config = settings.assistant;
	const github = new GitHubAppAdapter({
		...config.github,
		key: { withKey: (use) => assistantCredential(input.credentials, 'github-app-key.pem', use) }
	});
	const binding: Omit<SlackAdapterConfig, 'receive' | 'directMessages'> = {
		installation: {
			...settings.slack,
			installationId: settings.slack.appId,
			environment: 'project',
			project: config.project
		},
		channels: config.answerChannels,
		vault: {
			withToken: (scope, use) =>
				assistantCredential(
					input.credentials,
					scope.purpose === 'bot' ? 'slack-bot-token' : 'slack-socket-token',
					use
				)
		},
		audit: async (event) => {
			console.log(JSON.stringify(event));
		}
	};

	return {
		github,
		trackerRun: trackerRunner(input.tracker),
		model: new ClaudeMessagesAdapter({
			model: settings.model,
			maxTokens: 2000,
			withKey: (use) => assistantCredential(input.credentials, 'anthropic-api-key', use)
		}),
		slack: new SlackAdapter({
			...binding,
			directMessages: config.answerDirectMessages,
			receive: 'mentions'
		}),
		media: new AssistantSlackMediaAdapter(binding)
	};
}

async function qaPass(
	root: string,
	runtime: ReturnType<typeof createRuntime> & {
		settings: Awaited<ReturnType<typeof readAssistantConfig>>;
		plan: PlanAssistantQaRecording;
		since: string;
	}
) {
	const { assistant, qa: options, workspaceUrl } = runtime.settings;
	const healthUrl =
		options &&
		Object.values(assistant.health).find((target) => target === options.stagingUrl + '/api/health');
	if (!options || !healthUrl)
		throw new ProjectAssistantError('QA requires a staging health target.');
	const { assistantQa } = await import('./run-assistant/assistantQa');
	return assistantQa(
		{
			options,
			root,
			healthUrl,
			workspaceUrl,
			stagingBranch: assistant.github.stagingBranch,
			plan: runtime.plan,
			since: runtime.since
		},
		{
			...runtime,
			trackerNotes: new TrackerNoteAdapter({
				agent: assistant.tracker.agent,
				run: runtime.trackerRun
			})
		}
	);
}

async function qaRecipe(
	input: AssistantCommandOptions
): Promise<PlanAssistantQaRecording | undefined> {
	if (!input.qaRecipe && !input.qaSince) return undefined;
	if (
		!input.qaRecipe ||
		!isAbsolute(input.qaRecipe) ||
		!z.iso.datetime().safeParse(input.qaSince).success
	)
		throw new ProjectAssistantError(
			'QA requires an absolute recipe path and a UTC cutover timestamp.'
		);
	const recipe = await import(pathToFileURL(input.qaRecipe).href).catch(() => ({}));
	if (typeof recipe.planQaRecording !== 'function')
		throw new ProjectAssistantError('QA recipe must export planQaRecording.');
	return recipe.planQaRecording;
}

function trackerRunner(executable: string) {
	const exec = promisify(execFile);
	return async (args: readonly string[]) => {
		try {
			return (await exec(executable, [...args], { maxBuffer: 8 * 1024 * 1024, timeout: 30_000 }))
				.stdout;
		} catch {
			throw new ProjectAssistantError('Tracker command failed.');
		}
	};
}

async function runUntilStopped(
	service: SlackAssistantService,
	canvas: (() => Promise<unknown>) | undefined,
	qa: ((signal: AbortSignal) => Promise<unknown>) | undefined
): Promise<void> {
	const controller = new AbortController();
	const stop = () => controller.abort();
	process.once('SIGINT', stop);
	process.once('SIGTERM', stop);
	const { signal } = controller;
	const jobs: Promise<unknown>[] = [service.run(signal)];
	if (canvas) jobs.push(watch('canvas', canvas, signal));
	if (qa) jobs.push(watch('qa', () => qa(signal), signal));
	try {
		await Promise.all(jobs);
	} finally {
		stop();
		await Promise.allSettled(jobs);
		process.off('SIGINT', stop);
		process.off('SIGTERM', stop);
	}
}

async function watch(
	name: string,
	pass: () => Promise<unknown>,
	signal: AbortSignal
): Promise<void> {
	while (!signal.aborted) {
		try {
			await pass();
		} catch {
			console.error('Assistant ' + name + ' pass failed.');
		}
		await pause(300_000, undefined, { signal }).catch(() => {});
	}
}
