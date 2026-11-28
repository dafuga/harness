// @harness-uid u_z4ttafmvjp
import type { TrackerCosSafetyNotice } from './tracker-native-runtime-service/trackerCosDelivery.types';
import type { PushAsk, PushFetch } from './tracker-web-push-service/webPush.types';

export interface TrackerWebPushOptions {
	/** The journal path; the key and state files live beside it. */
	database: string;
	asks(): PushAsk[];
	now(): number;
	safety?: { read(): TrackerCosSafetyNotice | undefined; complete(generation: string): void };
	fetch?: PushFetch;
}
