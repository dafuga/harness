export const relayCloseCodes = {
	protocol: 4400,
	unauthorized: 4401,
	idle: 4408,
	replaced: 4409,
	tooLarge: 4413,
	rateLimited: 4429
} as const;
/** Request headers of `GET /v1/hosts/{hostId}/connect`, beside `Authorization: Bearer`. */
export const relayHeaders = { role: 'X-Harness-Role', device: 'X-Harness-Device' } as const;
