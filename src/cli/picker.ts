import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pickerPaths } from '../utils/pickerPaths';
import { ProviderSwitchRepository } from '../repositories/ProviderSwitchRepository';
import { ProviderCatalogAdapter } from '../adapters/ProviderCatalogAdapter';
import { ProviderSwitchService } from '../services/ProviderSwitchService';
import { CodexPickerMcpService } from '../services/CodexPickerMcpService';

const paths = pickerPaths();
const service = new ProviderSwitchService(
	new ProviderSwitchRepository(paths.home),
	new ProviderCatalogAdapter(paths.catalogs)
);
await new CodexPickerMcpService(
	service,
	await readFile(join(import.meta.dir, 'panel.html'), 'utf8')
).connect();
