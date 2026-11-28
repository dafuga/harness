// @harness-uid u_23yfiktdqa
export type SealedDeviceSessionState = 'first-device' | 'waiting-for-approval' | 'approved';

/** The same environment-bound, authenticated transport used for both requests. */
export type SealedSessionRequest = (path: string, request: RequestInit) => Promise<Response>;
