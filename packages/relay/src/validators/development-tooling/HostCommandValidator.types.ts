// @harness-uid u_dvhqqgtjas
export type Check = (value: unknown) => boolean;

export class HostCommandError extends Error {
	override name = 'HostCommandError';
}
