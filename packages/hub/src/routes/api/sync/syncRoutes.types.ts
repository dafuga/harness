import type { SyncCall } from './syncPolicy.types';

export type Handler = (call: SyncCall) => Promise<Response> | Response;
