import { caseShapeErrors, declaredInputErrors } from './test-case-validator/caseShapeErrors';
import type { ComponentManifest } from '../../core/development-tooling/unitTypes';
import type {
	ContractCase,
	TestContract
} from '../../services/verification-evidence/TestContractService.types';
import type { TestCaseValidatorResult } from './TestCaseValidator.types';
import { testContractSchema } from '../../services/verification-evidence/test-contract-service/testContractSchema';
import { exampleCaseErrors } from './test-case-validator/exampleCaseErrors';
import { declaredStateErrors, methodCaseErrors } from './test-case-validator/declaredCaseErrors';

/** Admission checks authored coverage, not merely test-file naming. */
export class TestCaseValidator {
	validate(unit: ComponentManifest, input: unknown): TestCaseValidatorResult {
		const parsed = testContractSchema.safeParse(input);
		if (!parsed.success)
			return {
				valid: false,
				errors: parsed.error.issues.map(
					(issue) => `${unit.id}: ${issue.path.join('.')}: ${issue.message}`
				)
			};
		const contract = parsed.data;
		const errors = [...this.identities(unit.id, contract), ...this.coverage(unit, contract)];
		return { valid: errors.length === 0, errors };
	}
	private identities(unit: string, contract: TestContract): string[] {
		const seen = new Set<string>();
		return contract.cases.flatMap((item) => {
			const errors = seen.has(item.id) ? [`${unit}: duplicate case ${item.id}`] : [];
			seen.add(item.id);
			if (contract.states && !contract.states.includes(item.state))
				errors.push(`${unit}: case ${item.id} names undeclared state ${item.state}`);
			errors.push(...caseShapeErrors(unit, contract, item));
			return errors;
		});
	}
	private coverage(unit: ComponentManifest, contract: TestContract): string[] {
		const errors = [
			...declaredStateErrors(unit.id, contract),
			...(contract.states ?? [])
				.filter((state) => !contract.cases.some((item) => item.state === state))
				.map((state) => `${unit.id}: missing state ${state}`)
		];
		if (unit.kind === 'layout' && contract.shape !== 'page')
			errors.push(
				`${unit.id}: layouts require the page screenshot form with a child-slot placeholder`
			);
		if (contract.shape === 'component' && !contract.cases.some((item) => item.state === 'rest'))
			errors.push(`${unit.id}: component requires its rest state`);
		if (contract.shape === 'helper') errors.push(...exampleCaseErrors(unit, contract));
		if (contract.shape === 'service') errors.push(...methodCaseErrors(unit, contract));
		if (contract.shape === 'page') errors.push(...pageViewportErrors(unit.id, contract));
		if (['page', 'component', 'api'].includes(contract.shape))
			errors.push(...duplicateMatrixRows(unit.id, contract));
		errors.push(...declaredInputErrors(unit, contract));
		return errors;
	}
}

/** One behavioral coordinate has one case, irrespective of case ID or expected output. */
function duplicateMatrixRows(unit: string, contract: TestContract): string[] {
	const states = new Map<string, ContractCase[]>();
	const errors: string[] = [];
	for (const item of contract.cases) {
		const previous = states.get(item.state) ?? [];
		if (previous.some((other) => sameMatrixCase(other, item, contract.shape)))
			errors.push(`${unit}: duplicate matrix row ${item.id}`);
		previous.push(item);
		states.set(item.state, previous);
	}
	return errors;
}

function sameMatrixCase(
	left: ContractCase,
	right: ContractCase,
	shape: TestContract['shape']
): boolean {
	return sameBehaviorCase(left, right) && matchingViewports(left.viewports, right.viewports, shape);
}

/** A page behavior may split its required device captures across registered cases. */
function pageViewportErrors(unit: string, contract: TestContract): string[] {
	const groups: ContractCase[][] = [];
	for (const item of contract.cases) {
		const group = groups.find((rows) => sameBehaviorCase(rows[0], item));
		if (group) group.push(item);
		else groups.push([item]);
	}
	return groups.flatMap((rows) => {
		const covered = new Set(rows.flatMap((row) => row.viewports ?? []));
		return ['desktop', 'tablet', 'mobile']
			.filter((viewport) => !covered.has(viewport))
			.map((viewport) => `${unit}: page case ${rows[0].id} missing viewport ${viewport}`);
	});
}

function sameBehaviorCase(left: ContractCase, right: ContractCase): boolean {
	if (
		left.state !== right.state ||
		left.subject !== right.subject ||
		left.example !== right.example
	)
		return false;
	if (left.fixture !== right.fixture || left.call !== right.call) return false;
	if (Object.hasOwn(left, 'input') !== Object.hasOwn(right, 'input')) return false;
	return (
		sameNames(left.props, right.props) &&
		sameNames(left.errors, right.errors) &&
		sameData(left.input, right.input)
	);
}

function matchingViewports(
	left: string[] | undefined,
	right: string[] | undefined,
	shape: TestContract['shape']
): boolean {
	if (shape === 'api' || !left || !right) return sameNames(left, right);
	return left.some((viewport) => right.includes(viewport));
}

function sameNames(left: string[] | undefined, right: string[] | undefined): boolean {
	const a = [...new Set(left ?? [])].sort(),
		b = [...new Set(right ?? [])].sort();
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Compare admitted JSON graphs without traversing their prototypes or losing cycles. */
function sameData(left: unknown, right: unknown): boolean {
	const context = {
		pending: [[left, right]] as Array<[unknown, unknown]>,
		left: new Map<object, object>(),
		right: new Map<object, object>()
	};
	while (context.pending.length) {
		const [a, b] = context.pending.pop()!;
		if (a === b && (a === null || typeof a !== 'object')) continue;
		if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
		if (!sameObject(a, b, context)) return false;
	}
	return true;
}

function sameObject(
	a: object,
	b: object,
	context: {
		pending: Array<[unknown, unknown]>;
		left: Map<object, object>;
		right: Map<object, object>;
	}
): boolean {
	if (context.left.has(a) || context.right.has(b))
		return context.left.get(a) === b && context.right.get(b) === a;
	context.left.set(a, b);
	context.right.set(b, a);
	if (a === b) return true;
	if (Array.isArray(a) !== Array.isArray(b)) return false;
	return Array.isArray(a) && Array.isArray(b)
		? sameArray(a, b, context.pending)
		: sameRecord(a, b, context.pending);
}

function sameArray(a: unknown[], b: unknown[], pending: Array<[unknown, unknown]>): boolean {
	if (a.length !== b.length) return false;
	for (let index = 0; index < a.length; index++) pending.push([a[index], b[index]]);
	return true;
}

function sameRecord(a: object, b: object, pending: Array<[unknown, unknown]>): boolean {
	const first = Object.keys(a).sort(),
		second = Object.keys(b).sort();
	if (first.length !== second.length || first.some((key, index) => key !== second[index]))
		return false;
	for (const key of first)
		pending.push([(a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]]);
	return true;
}
export type { TestCaseValidatorResult } from './TestCaseValidator.types';
