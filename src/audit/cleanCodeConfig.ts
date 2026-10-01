import { fail } from '../core/errors';
import type { CleanCodeOptions, CleanCodeSettings } from './cleanCodeTypes';

export const cleanCodeDefaults: CleanCodeSettings = {
	mode: 'off',
	model: 'jev-1.13.0',
	minConfidence: 0.85,
	apiKeyEnv: 'HARNESS_JEV_API_KEY',
	exclude: []
};

export function resolveCleanCodeSettings(
	raw: unknown,
	options: CleanCodeOptions = {}
): CleanCodeSettings {
	const config = configObject(raw);
	const configuredMode = config.mode ?? 'off';
	if (!['off', 'advisory', 'gate'].includes(String(configuredMode))) invalid('mode');
	const mode = resolveMode(configuredMode as CleanCodeSettings['mode'], options);
	return {
		mode,
		minConfidence: confidenceThreshold(config.minConfidence),
		apiKeyEnv: credentialVariable(config.apiKeyEnv),
		model: modelName(config.model),
		exclude: exclusions(config.exclude)
	};
}

function confidenceThreshold(raw: unknown): number {
	const value = raw ?? cleanCodeDefaults.minConfidence;
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1)
		return invalid('minConfidence');
	return value;
}

function credentialVariable(raw: unknown): string {
	const value = raw ?? cleanCodeDefaults.apiKeyEnv;
	if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_]*$/.test(value)) return invalid('apiKeyEnv');
	return value;
}

function configObject(raw: unknown): Record<string, unknown> {
	if (raw === undefined) return {};
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
		return invalid('configuration');
	return raw as Record<string, unknown>;
}

function resolveMode(
	mode: CleanCodeSettings['mode'],
	options: CleanCodeOptions
): CleanCodeSettings['mode'] {
	if (options.gate) return 'gate';
	if (options.enabled && mode === 'off') return 'advisory';
	if ((options.dryRun || options.refresh) && mode === 'off')
		invalid('mode: enable review with --clean-code');
	return mode;
}

function modelName(raw: unknown): string {
	if (raw === undefined) return cleanCodeDefaults.model;
	if (typeof raw !== 'string' || !/^jev-[a-zA-Z0-9.-]+$/.test(raw)) return invalid('model');
	return raw;
}

function exclusions(raw: unknown): string[] {
	if (raw === undefined) return [];
	if (!Array.isArray(raw) || raw.some((value) => typeof value !== 'string' || !value.trim()))
		return invalid('exclude');
	return raw as string[];
}

function invalid(field: string): never {
	return fail(`Invalid harness.audit.json cleanCode.${field}.`);
}
