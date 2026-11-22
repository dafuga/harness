// @harness-uid u_bjzxwihuau
import type { z } from 'zod';
import type { receiptSchema } from './browserDockerJournal';

export type VaultDockerReceipt = z.infer<typeof receiptSchema>;
