import type { ModelChoice } from '../../models/Desktop.types.ts';

export function validateModel(models: ModelChoice[], model: string, effort: string | null): void {
	const selected = models.find((m) => m.id === model);
	if (!selected) throw new Error('The selected model is not available from this CLI.');
	if (effort && !selected.efforts.includes(effort))
		throw new Error('The selected model does not support this effort.');
}
