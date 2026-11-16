// @harness-uid u_cy5r7zckyu
import { ExpectedCliError } from '../../../../../../src/core/development-tooling/errors';
import type { ModelChoice } from '../../../models/development-tooling/Desktop.types';

export function validateModel(models: ModelChoice[], model: string, effort: string | null): void {
	const selected = models.find((m) => m.id === model);
	if (!selected) throw new ExpectedCliError('The selected model is not available from this CLI.');
	if (effort && !selected.efforts.includes(effort))
		throw new ExpectedCliError('The selected model does not support this effort.');
}
