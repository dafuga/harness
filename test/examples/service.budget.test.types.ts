import type { BudgetService } from '../../src/services/verification-evidence/budget-service/BudgetService';

export type Ledger = Parameters<BudgetService['baselines']>[0];

export type Manifests = Parameters<BudgetService['baselines']>[1];

export type Context = Parameters<BudgetService['evaluate']>[1];
