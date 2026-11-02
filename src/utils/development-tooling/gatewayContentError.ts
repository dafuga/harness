// @harness-uid u_xgpokbzqog
export function gatewayContentError(message: string): Error {
	const error = new Error(message);
	error.name = 'GatewayContentError';
	return error;
}
