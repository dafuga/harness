import { sharedReuseRule } from './eslint.reuse-rules.js';
import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

/** Lower layers never reach up: shared declarations belong in src/core, operations in services. */
const layerDirections = [
	{
		from: 'src/utils/',
		targets: ['src/services/', 'src/workflows/', 'src/cli/'],
		message:
			'Utility modules must not import services, workflows or the CLI. Move the shared declaration into src/core or the owner into src/services.'
	},
	{
		from: 'src/services/',
		targets: ['src/workflows/', 'src/cli/'],
		message:
			'Service modules must not import workflows or the CLI. Move the shared declaration into src/core or the service out of its workflow or command folder.'
	}
];

const repositoryRoot = fileURLToPath(new URL('.', import.meta.url));

/** Existing edges, each with the TODO that retires it; a new edge is not admitted here. */
export const layerAllowlist = readLayerAllowlist();

export default {
	rules: {
		'shared-reuse': sharedReuseRule,
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
		'thin-command-modules': importBoundaryRule('thin-command-modules'),
		'layer-direction': layerDirectionRule()
	}
};

/** The upward edge a relative specifier makes from a file, whether or not it is allowlisted. */
export function layerEdge(filename, source) {
	if (!source.startsWith('.')) return undefined;
	const file = repositoryPath(filename);
	const target = repositoryPath(fileURLToPath(new URL(source, pathToFileURL(filename)))).replace(
		/\.(ts|js)$/,
		''
	);
	const direction = layerDirections.find(
		(entry) => file.startsWith(entry.from) && entry.targets.some((path) => target.startsWith(path))
	);
	return direction && { file, target, message: direction.message };
}

function layerDirectionRule() {
	return {
		meta: { type: 'problem', messages: { upward: '{{message}} ({{target}})' } },
		create(context) {
			const check = (node, literal) => {
				if (typeof literal?.value !== 'string') return;
				const edge = layerEdge(context.filename, literal.value);
				if (edge && !layerAllowlist.has(`${edge.file} -> ${edge.target}`))
					context.report({ node, messageId: 'upward', data: edge });
			};
			const declared = (node) => check(node, node.source);
			return {
				ImportDeclaration: declared,
				ExportNamedDeclaration: declared,
				ExportAllDeclaration: declared,
				ImportExpression: declared,
				TSImportType: (node) => check(node, node.source ?? node.argument?.literal)
			};
		}
	};
}

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

function repositoryPath(path) {
	return normalize(relative(repositoryRoot, path));
}

function readLayerAllowlist() {
	const path = new URL('./eslint.layer-allowlist.json', import.meta.url);
	if (!existsSync(path)) return new Map();
	const { edges } = JSON.parse(readFileSync(path, 'utf8'));
	return new Map(edges.map((edge) => [`${edge.from} -> ${edge.to}`, edge.todo]));
}
