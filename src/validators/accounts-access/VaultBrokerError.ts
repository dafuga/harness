// @harness-uid u_23xwb3xbkg
import { ExpectedCliError } from '../../core/development-tooling/errors';

/** A refusal the broker returns to its caller with an HTTP status and no secret detail. */
export class VaultBrokerError extends ExpectedCliError {
	override name = 'VaultBrokerError';
	constructor(
		readonly status: number,
		message: string
	) {
		super(message);
	}
}
