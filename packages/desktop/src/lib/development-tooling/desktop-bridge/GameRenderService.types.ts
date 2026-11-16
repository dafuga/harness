// @harness-uid u_7wdnzhrfl5
export class GameRenderBusyError extends Error {
	override name = 'GameRenderBusyError';
}

export class CredentialSafeProviderTransportUnavailableError extends Error {
	override name = 'CredentialSafeProviderTransportUnavailableError';
}

export class DecartTokenRequestError extends Error {
	override name = 'DecartTokenRequestError';
}

export class InvalidDecartTokenResponseError extends Error {
	override name = 'InvalidDecartTokenResponseError';
}
