import type { ComponentManifest } from '../../../core/development-tooling/unitTypes';
import type {
	ContractCase,
	TestContract
} from '../../../services/verification-evidence/TestContractService.types';

const checks = {
	page: visualError,
	component: visualError,
	api: apiError,
	service: serviceError,
	helper: () => []
};
export function caseShapeErrors(
	unit: string,
	contract: TestContract,
	item: ContractCase
): string[] {
	return checks[contract.shape](unit, item);
}
function visualError(unit: string, item: ContractCase): string[] {
	return item.expected?.kind === 'screenshot' && item.viewports?.length
		? []
		: [`${unit}: visual case ${item.id} requires screenshot matching and viewports`];
}
function apiError(unit: string, item: ContractCase): string[] {
	return item.expected?.kind === 'json'
		? []
		: [`${unit}: API case ${item.id} requires an authored JSON response`];
}
function serviceError(unit: string, item: ContractCase): string[] {
	return item.subject && item.expected
		? []
		: [`${unit}: class case ${item.id} requires a method and authored result or error`];
}
export function declaredInputErrors(unit: ComponentManifest, contract: TestContract): string[] {
	const props = (contract.props ?? [])
		.filter((prop) => !contract.cases.some((item) => item.props?.includes(prop)))
		.map((prop) => `${unit.id}: missing supported prop ${prop}`);
	const errors = unit.contract.errors
		.filter((error) => !contract.cases.some((item) => item.errors?.includes(error.name)))
		.map((error) => `${unit.id}: missing error ${error.name}`);
	return [...props, ...errors];
}
