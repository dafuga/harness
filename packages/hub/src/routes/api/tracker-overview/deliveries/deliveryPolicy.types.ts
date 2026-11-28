import type { OverviewDeps } from '../trackerOverviewPolicy.types';

export type DeliveryDeps = Pick<OverviewDeps, 'ownerId' | 'sessions'> & {
	bucket: R2Bucket | undefined;
};
