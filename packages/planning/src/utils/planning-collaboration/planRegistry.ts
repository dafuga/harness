/** Artifact folders are planning history, never active implementation units. */
export const planningIgnores = [
	'pages',
	'shells',
	'layouts',
	'components',
	'functions',
	'services',
	'configs'
].flatMap((category) => [
	`**/src/${category}/*/plan.json`,
	`**/src/${category}/*/.gitattributes`,
	`**/src/${category}/*/designs/**/*`,
	`**/src/${category}/*/threads/**/*`
]);

export { planRegistry } from '../../lib/planning-collaboration/planning/planning-service/planRegistry';
