import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ProviderSwitchRepository } from '../repositories/ProviderSwitchRepository';
import { ProviderSwitchService } from '../services/ProviderSwitchService';
import { ProviderCatalogAdapter } from '../adapters/ProviderCatalogAdapter';
import { CodexPickerMcpService } from '../services/CodexPickerMcpService';
import { PickerPreviewService } from '../services/PickerPreviewService';
import { pickerPaths } from '../utils/pickerPaths';

export function registerCodexPickerCommand(codex: Command): void {
	codex
		.command('picker-mcp')
		.requiredOption('--panel-file <path>', 'Built picker HTML resource.')
		.action(async (options: { panelFile: string }) => {
			const paths = pickerPaths();
			const service = new ProviderSwitchService(
				new ProviderSwitchRepository(paths.home),
				new ProviderCatalogAdapter(paths.catalogs)
			);
			await new CodexPickerMcpService(service, await readFile(options.panelFile, 'utf8')).connect();
		});
	codex
		.command('picker-preview')
		.requiredOption('--panel-file <path>', 'Built picker HTML resource.')
		.option('--port <port>', 'Isolated preview port.', '47839')
		.action(async (options: { panelFile: string; port: string }) => {
			const home = resolve('.cache/codex-picker-preview');
			const catalog = new ProviderCatalogAdapter(pickerPaths().catalogs);
			const service = new ProviderSwitchService(new ProviderSwitchRepository(home), catalog);
			const origin = `http://127.0.0.1:${Number(options.port)}`;
			const preview = new PickerPreviewService(
				service,
				() => readFile(options.panelFile, 'utf8'),
				origin
			);
			Bun.serve({
				hostname: '127.0.0.1',
				port: Number(options.port),
				fetch: (request) => preview.fetch(request)
			});
			console.log(`Isolated picker preview: ${origin}/preview`);
		});
}
