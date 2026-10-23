import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import {
	resourceConfigSchema,
	type ResourceConfig
} from '../../core/execution-runtimes/resourceTypes';
export function resourceHome(env: Record<string, string | undefined> = process.env): string {
	return resolve(env.HARNESS_RESOURCES_HOME ?? join(homedir(), '.codex', 'harness', 'resources'));
}
export function resourceConfig(home = resourceHome()): ResourceConfig {
	const path = join(home, 'config.json');
	return resourceConfigSchema.parse(existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {});
}
export function saveResourceConfig(config: ResourceConfig, home = resourceHome()): void {
	const parsed = resourceConfigSchema.parse(config);
	mkdirSync(home, { recursive: true, mode: 0o700 });
	const temporary = join(home, `config.${randomUUID()}.partial`);
	writeFileSync(temporary, JSON.stringify(parsed, null, 2) + '\n', { mode: 0o600 });
	renameSync(temporary, join(home, 'config.json'));
}
