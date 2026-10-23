import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type { BudgetEvent } from '../../../core/verification-evidence/budgetTypes';
import type { UnitBaseline } from '../../../services/verification-evidence/budget-service/BudgetService';
import type { BudgetLedgerRepository } from '../../../repositories/verification-evidence/BudgetLedgerRepository';

export interface SignedInput {
	root?: string;
	units: string[];
	all?: boolean;
	record: string;
	reviewer?: string;
	reason?: string;
	now?: () => string;
}

export interface Loaded {
	root: string;
	manifests: ComponentManifest[];
	events: BudgetEvent[];
	baselines: Map<string, UnitBaseline>;
	ledger: BudgetLedgerRepository;
}

export interface BenchInput {
	unit: string;
	workload: string;
	target?: string;
	evidence?: string;
	state?: string;
}
