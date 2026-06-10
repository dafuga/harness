import { existsSync, readFileSync } from 'node:fs';

const limits = {
	maxFileLines: 220,
	maxFunctionLines: 55,
	maxClassLines: 120,
	maxMethodLines: 35,
	maxNestingDepth: 4,
	maxParameters: 4,
	maxComplexity: 10,
	maxClassesPerFile: 1
};

export const harnessRuleLimits = readHarnessLimits();

const forbiddenImports = [
	{
		from: '/src/core/',
		rule: 'architecture-boundaries',
		targets: ['/src/templates/', '/src/workflows/', '/src/commands/'],
		message: 'Core modules must not import templates, workflows, or commands.'
	},
	{
		from: '/src/templates/',
		rule: 'architecture-boundaries',
		targets: ['/src/workflows/', '/src/commands/'],
		message: 'Template modules must not import workflows or commands.'
	},
	{
		from: '/src/commands/',
		rule: 'thin-command-modules',
		targets: ['/src/templates/', '/src/core/files', '/src/core/fields'],
		message:
			'Command modules should delegate instead of importing templates or file-generation helpers.'
	}
];

export default {
	rules: {
		'max-class-lines': {
			meta: {
				type: 'suggestion',
				messages: {
					tooLarge: 'Class has {{lines}} lines. Keep classes at or below {{max}} lines.'
				}
			},
			create(context) {
				return {
					ClassDeclaration(node) {
						const lines = nodeLines(node);
						if (lines > harnessRuleLimits.maxClassLines) {
							context.report({
								node,
								messageId: 'tooLarge',
								data: { lines, max: harnessRuleLimits.maxClassLines }
							});
						}
					}
				};
			}
		},
		'max-method-lines': {
			meta: {
				type: 'suggestion',
				messages: {
					tooLarge: 'Method has {{lines}} lines. Keep methods at or below {{max}} lines.'
				}
			},
			create(context) {
				return {
					MethodDefinition(node) {
						const lines = nodeLines(node);
						if (lines > harnessRuleLimits.maxMethodLines) {
							context.report({
								node,
								messageId: 'tooLarge',
								data: { lines, max: harnessRuleLimits.maxMethodLines }
							});
						}
					}
				};
			}
		},
		'no-manager-name': {
			meta: {
				type: 'suggestion',
				messages: {
					manager: 'Avoid catch-all Manager class names. Name the concrete responsibility instead.'
				}
			},
			create(context) {
				return {
					ClassDeclaration(node) {
						if (node.id?.name?.endsWith('Manager')) {
							context.report({ node: node.id, messageId: 'manager' });
						}
					}
				};
			}
		},
		'architecture-boundaries': importBoundaryRule('architecture-boundaries'),
		'thin-command-modules': importBoundaryRule('thin-command-modules')
	}
};

function importBoundaryRule(ruleName) {
	return {
		meta: {
			type: 'problem',
			messages: {
				forbidden: '{{message}}'
			}
		},
		create(context) {
			return {
				ImportDeclaration(node) {
					const matched = boundaryViolation(context.filename, String(node.source.value), ruleName);
					if (matched) {
						context.report({ node, messageId: 'forbidden', data: { message: matched.message } });
					}
				}
			};
		}
	};
}

function boundaryViolation(filename, source, ruleName) {
	const normalizedFile = normalize(filename);
	const normalizedSource = normalize(new URL(source, `file://${normalizedFile}`).pathname);

	return forbiddenImports.find(
		(entry) =>
			entry.rule === ruleName &&
			normalizedFile.includes(entry.from) &&
			entry.targets.some((target) => normalizedSource.includes(target))
	);
}

function nodeLines(node) {
	return node.loc.end.line - node.loc.start.line + 1;
}

function readHarnessLimits() {
	const path = new URL('./harness.audit.json', import.meta.url);
	if (!existsSync(path)) return limits;
	const config = JSON.parse(readFileSync(path, 'utf8'));
	return { ...limits, ...positiveLimits(config.limits ?? {}) };
}

function positiveLimits(config) {
	return Object.fromEntries(
		Object.entries(config).filter(([, value]) => Number.isInteger(value) && value > 0)
	);
}

function normalize(value) {
	return value.replaceAll('\\', '/');
}
