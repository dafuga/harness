import type { RepositoryIdentity } from 'collaboration';

export type ApiRepository = Omit<RepositoryIdentity, 'installationId'> & { admin: boolean };

export interface InstallationPage {
	repositories: ApiRepository[];
	total: number;
}

export interface OwnerFixture {
	installations: { ids: number[]; total: number } | null;
	identity?: RepositoryIdentity;
	admin?: boolean;
	pages?: Map<number, InstallationPage>;
}

export interface AuthorizationExample {
	name: string;
	repositoryId: number;
	fixture: OwnerFixture;
	expected: { output: RepositoryIdentity } | { error: string };
}
