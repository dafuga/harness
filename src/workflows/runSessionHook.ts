import { JevAdapter } from '../adapters/JevAdapter';
import type { JevEvaluator } from '../audit/cleanCodeEvaluate';
import { readAuditConfig } from '../audit/config';
import { reviewHash } from '../audit/cleanCodeFiles';
import { reviewCleanCode } from './reviewCleanCode';
import { recordCleanCode } from './recordJevAnalytics';
import { parseSessionEvent, readSessionCredential, readSessionSettings } from './sessionHookConfig';
import { sessionProject } from './sessionProject';
import {
	sessionHookFailure,
	sessionHookSummary,
	type SessionHookOutput
} from './sessionHookSummary';

export interface SessionRunOptions {
	settings: string;
	dryRun?: boolean;
	refresh?: boolean;
}

export async function runSessionHook(
	input: string,
	options: SessionRunOptions
): Promise<SessionHookOutput> {
	try {
		const event = parseSessionEvent(input);
		if (!event) return {};
		const config = await readSessionSettings(options.settings);
		const root = await sessionProject(event.cwd, config.roots);
		if (!root) return {};
		const settings = {
			...readAuditConfig(root).cleanCode,
			mode: 'advisory' as const,
			apiKeyEnv: 'HARNESS_JEV_API_KEY'
		};
		const adapter = options.dryRun
			? undefined
			: new JevAdapter({
					apiKey: await readSessionCredential(config.credentialFile),
					model: settings.model
				});
		const started = Date.now();
		const report = await reviewCleanCode({
			root,
			settings,
			options: {
				dryRun: options.dryRun,
				refresh: options.refresh,
				signal: AbortSignal.timeout(110000)
			},
			evaluate: adapter ? sessionEvaluator(adapter) : undefined
		});
		await recordCleanCode(
			report,
			{ task: `session-${reviewHash(event.session_id).slice(0, 24)}` },
			{ root, durationMs: Date.now() - started }
		);
		return sessionHookSummary(report);
	} catch {
		return sessionHookFailure();
	}
}

function sessionEvaluator(adapter: JevAdapter): JevEvaluator {
	let failure: Error | undefined;
	return async (request, signal) => {
		if (failure) throw failure;
		try {
			return await adapter.evaluate(request, signal);
		} catch (error) {
			failure = error instanceof Error ? error : new Error('Jev request failed.');
			throw failure;
		}
	};
}
