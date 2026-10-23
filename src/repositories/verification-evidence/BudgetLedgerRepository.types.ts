import type { BudgetEvent } from '../../core/verification-evidence/budgetTypes';

export interface LedgerRead {
	text: string;
	events: BudgetEvent[];
	errors: string[];
}
