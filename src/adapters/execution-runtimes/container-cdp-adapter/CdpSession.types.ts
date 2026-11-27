// @harness-uid u_t36g6lngv3
export interface CdpPending {
	resolve(value: unknown): void;
	reject(error: Error): void;
	timer: ReturnType<typeof setTimeout>;
}
