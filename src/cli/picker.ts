import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pickerPaths } from './program/codex-picker-command/pickerPaths';
import { ProviderSwitchRepository } from '../repositories/agents-providers/ProviderSwitchRepository';
import { ProviderCatalogAdapter } from '../adapters/agents-providers/ProviderCatalogAdapter';
import { ProviderSwitchService } from '../services/agents-providers/ProviderSwitchService';
import { CodexPickerMcpService } from '../services/agents-providers/CodexPickerMcpService';

const paths = pickerPaths();
const service = new ProviderSwitchService(
	new ProviderSwitchRepository(paths.home),
	new ProviderCatalogAdapter(paths.catalogs)
);
await new CodexPickerMcpService(
	service,
	await readFile(join(import.meta.dir, 'panel.html'), 'utf8')
).connect();
