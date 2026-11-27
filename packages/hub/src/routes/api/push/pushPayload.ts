import { z } from 'zod';
import { webPushContract } from '../../../../../../src/utils/projects-sessions/webPushContract';
import { isWebPushEndpoint } from '../../../../../../src/utils/projects-sessions/isWebPushEndpoint';

const endpoint = z.string().refine(isWebPushEndpoint);
const base64url = (length: number) => z.string().regex(new RegExp(`^[A-Za-z0-9_-]{${length}}$`));
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);

/** What `PushSubscription.toJSON()` gives: a 65-byte public key and a 16-byte secret. */
export const subscriptionInput = z.object({
	endpoint,
	keys: z.object({ p256dh: base64url(87), auth: base64url(22) })
});
export const removalInput = z.strictObject({ endpoint });
export const quietInput = z.strictObject({
	quiet: z.strictObject({ enabled: z.boolean(), start: clock, end: clock })
});
export const reportInput = z.strictObject({
	delivered: z.array(endpoint).max(webPushContract.maxSubscriptions),
	gone: z.array(endpoint).max(webPushContract.maxSubscriptions)
});
