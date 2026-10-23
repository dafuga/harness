import type { RateBucket } from '../../../models/networking-security/RelayHost.types';
import type { RateRecord } from '../../../models/networking-security/RelayHost.types';

/** Where the windows are kept: the storage of the host object, so that they outlive its memory. */
export interface RateStore {
	rate(bucket: RateBucket): RateRecord | undefined;
	saveRate(bucket: RateBucket, record: RateRecord): void;
}
