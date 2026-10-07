import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
interface ReportSettings {
	configFile?: string;
	cloudflareConfigHome?: string;
}
export function reportsEnvironment(): typeof process.env {
	const file =
		process.env.HARNESS_REPORTS_SETTINGS_FILE ??
		join(homedir(), '.codex', 'harness', 'report-settings.json');
	let settings: ReportSettings = {};
	try {
		settings = JSON.parse(readFileSync(file, 'utf8')) as ReportSettings;
	} catch (error) {
		if ((error as { code?: string }).code !== 'ENOENT')
			throw new Error('Invalid Harness report settings file.');
	}
	return {
		...process.env,
		PROJECT_REPORTS_CONFIG_FILE: process.env.PROJECT_REPORTS_CONFIG_FILE ?? settings.configFile,
		PROJECT_REPORTS_CLOUDFLARE_CONFIG_HOME:
			process.env.PROJECT_REPORTS_CLOUDFLARE_CONFIG_HOME ?? settings.cloudflareConfigHome
	};
}
