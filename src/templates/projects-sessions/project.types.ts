// @harness-uid u_v4r6unildz
export type ProjectKind = 'app' | 'lib' | 'game';
export type AppAdapter = 'auto' | 'static';

export interface ProjectTemplateInput {
	name: string;
	kind: ProjectKind;
	dimension?: '2d' | '3d';
	adapter?: AppAdapter;
}
