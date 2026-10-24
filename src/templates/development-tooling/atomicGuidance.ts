/** Shared policy emitted into tenant agent rules and the Harness skill. */
export function atomicComponentRules(): string {
	return `## Atomic UI composition

- Build Svelte UI as atoms → molecules → organisms → layouts/templates → pages. Keep the responsibility category and stable unit identity independent of this level.
- Use the existing shared control first. Molecules compose atoms; organisms compose atoms, molecules and smaller organisms. Layouts frame these with a real child-content slot; pages supply route data. Never import a page/layout into a molecule or organism.
- Native elements belong in atoms. Harness provides a separate atom for every conforming HTML element, each input type, SVG elements and dynamic elements. Discover them with \`harness info component\`; install the library with \`harness generate elements\`.
- Declare \`<!-- @harness-tier molecule -->\` (or atom, organism, layout, page). Generated components default to molecule; use \`--level organism\` for a feature section. An atom owns native presentation, never feature data loading or composed components.
- Native atom calls such as \`<hx-button type="button">Save</hx-button>\` use the canonical HtmlButton component definition. Declare its relative library directory with \`<!-- @harness-atoms ./atoms -->\`. Native bindings, actions, events, semantics and scoped styles are preserved by \`atomicComponents()\` before Svelte compilation. Keep its generated native typings and Svelte integration installed; these tags are compiled atoms, not runtime custom elements.
- Basic static atoms also support direct Svelte imports. For native bindings/actions, use the native atom call. Keep native atom definitions generated and free of feature logic/styles; put themed controls and validation in reusable molecules using the project's own design tokens.
- Framework document entry files and Svelte framework directives retain their supported syntax. Third-party component internals and trusted rendered source/HTML content are not an instruction to duplicate those implementations.
- Run \`harness audit\`, \`harness units check\`, focused interaction tests and the standard visual catalog. Check value binding, form submission, disabled/required states, labels, focus, dialogs and each affected viewport. Do not accept imports or an unchanged-looking screenshot as interaction proof.
`;
}
