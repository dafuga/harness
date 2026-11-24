// @harness-uid u_qb5hhfkfec
import type { z } from 'zod';
import type {
	approvalCard,
	approvalCards,
	approvalDecision,
	approvalReceipt
} from './approvalInbox';

export type ApprovalCard = z.infer<typeof approvalCard>;
export type ApprovalCards = z.infer<typeof approvalCards>;
export type ApprovalDecision = z.infer<typeof approvalDecision>;
export type ApprovalReceipt = z.infer<typeof approvalReceipt>;
