import type { z } from 'zod';
import type { vaultPaymentScope } from './VaultPaymentValidator';

export type VaultPaymentScope = z.infer<typeof vaultPaymentScope>;
