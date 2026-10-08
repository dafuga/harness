import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { PickerModel } from '../core/pickerModelTypes';

const catalogSchema = z.object({
	models: z.array(
		z.object({
			slug: z.string().min(1).max(150),
			display_name: z.string().max(200),
			visibility: z.string().optional(),
			default_reasoning_level: z.string(),
			supported_reasoning_levels: z.array(z.object({ effort: z.string() })).min(1)
		})
	)
});

export class ProviderCatalogAdapter {
	constructor(private readonly paths: { openai: string; claude: string }) {}
	async list(): Promise<PickerModel[]> {
		const native = await this.read(this.paths.openai, 'openai');
		const claude = await this.read(this.paths.claude, 'harness-claude');
		return [...native, ...claude];
	}

	private async read(path: string, provider: PickerModel['provider']): Promise<PickerModel[]> {
		let data;
		try {
			data = catalogSchema.parse(JSON.parse(await readFile(path, 'utf8')));
		} catch {
			return [];
		}
		return data.models
			.filter((m) => m.visibility !== 'hide')
			.map((m) => ({
				provider,
				model: m.slug,
				label: m.display_name,
				efforts: m.supported_reasoning_levels.map((level) => level.effort),
				defaultEffort: m.default_reasoning_level,
				source: 'local-catalog' as const
			}));
	}
}
