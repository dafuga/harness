export type Role = 'owner' | 'commenter' | 'viewer';
export interface Actor {
	id: string;
	email: string;
	name: string;
	emailVerified: true;
}
export interface RepositoryIdentity {
	id: number;
	owner: string;
	name: string;
	private: boolean;
	installationId: number;
}
export interface Project {
	id: string;
	name: string;
	sourceRepository: RepositoryIdentity;
	createdAt: string;
	ownerId: string;
}
export interface ProjectSummary extends Project {
	role: Role;
	collaborationCommit?: string;
}
export interface Member {
	projectId: string;
	actorId: string;
	email: string;
	name: string;
	role: Role;
}
export interface Invitation {
	id: string;
	projectId: string;
	expiresAt: string;
	code: string;
}
export interface Anchor {
	branch: string;
	commit: string;
	entityId: string;
	version: string | null;
	imageSha256: string | null;
	state: string | null;
	viewport: string | null;
	region: { x: number; y: number; width: number; height: number } | null;
}
export interface Comment {
	id: string;
	requestId: string;
	actor: Actor;
	text: string;
	createdAt: string;
}
export interface Thread {
	id: string;
	projectId: string;
	anchor: Anchor;
	comments: Comment[];
}
export interface CommittedThread extends Thread {
	collaborationCommit: string;
}
export interface StoredInvitation extends Omit<Invitation, 'code'> {
	codeHash: string;
	email: string;
	role: Exclude<Role, 'owner'>;
	acceptedBy: string | null;
}
export interface CollaborationRecords {
	schemaVersion: 1;
	projects: Project[];
	members: Member[];
	invitations: StoredInvitation[];
	threads: Thread[];
}
/** An all-zero revision denotes a missing configured collaboration branch, never a source commit. */
export interface RecordSnapshot {
	revision: string;
	records: CollaborationRecords;
}
/** read always checks remote authority; compareAndSwap never forces a ref update. */
export interface CollaborationRepository {
	read(): Promise<RecordSnapshot>;
	compareAndSwap(expected: string, records: CollaborationRecords): Promise<string | null>;
}
export interface SourceCommit {
	commit: string;
	tree: string;
}
/** One commit as Git states it: its parents in their order, its title and who made it when. */
export interface SourceCommitFacts extends SourceCommit {
	parents: string[];
	subject: string;
	author: string;
	committedAt: string;
}
export interface SourceEntry {
	path: string;
	sha: string;
	type: 'blob' | 'tree' | 'commit';
	mode: string;
	size?: number;
}
export interface SourceAdapter {
	resolve(repository: RepositoryIdentity, ref: string): Promise<SourceCommit>;
	tree(repository: RepositoryIdentity, commit: string): Promise<SourceEntry[]>;
	read(
		repository: RepositoryIdentity,
		input: { commit: string; path: string }
	): Promise<Uint8Array>;
	validateAnchor(repository: RepositoryIdentity, anchor: Anchor): Promise<void>;
}
export interface CacheIdentity {
	collaborationRevision?: string | null;
	principalId: string;
	projectId: string;
	repositoryId: number;
	requestedRef: string;
	sourceCommit: string;
	sourceTree: string;
	notesRef: string | null;
	notesRevision: string | null;
	evidenceRef: string | null;
	evidenceRevision: string | null;
	historyIndexRevision: string | null;
	artifactHash: string | null;
	profile: string | null;
}
export interface CacheEntry {
	identity: CacheIdentity;
	sha256: string;
	bytes: Uint8Array;
}
export interface CollaborationCache {
	get(key: string): Promise<CacheEntry | null>;
	put(key: string, entry: CacheEntry): Promise<void>;
	delete(key: string): Promise<void>;
}
export interface CollaborationDependencies {
	repository: CollaborationRepository;
	source: SourceAdapter;
	cache: CollaborationCache;
	authorizeRepository(actor: Actor, repositoryId: number): Promise<RepositoryIdentity>;
	now?: () => Date;
}
export interface AddCommentInput {
	projectId: string;
	requestId: string;
	threadId?: string;
	anchor: Anchor;
	text: string;
}
export interface CollaborationApi {
	listProjects(actor: Actor): Promise<ProjectSummary[]>;
	createProject(
		actor: Actor,
		input: { name: string; repositoryId: number }
	): Promise<ProjectSummary>;
	getProject(actor: Actor, projectId: string): Promise<ProjectSummary>;
	listMembers(actor: Actor, projectId: string): Promise<Member[]>;
	removeMember(actor: Actor, input: { projectId: string; memberId: string }): Promise<void>;
	createInvitation(
		actor: Actor,
		input: { projectId: string; email: string; role: Exclude<Role, 'owner'> }
	): Promise<Invitation>;
	acceptInvitation(
		actor: Actor,
		input: { projectId: string; invitationId: string; code: string }
	): Promise<ProjectSummary>;
	addComment(actor: Actor, input: AddCommentInput): Promise<CommittedThread>;
	listThreads(
		actor: Actor,
		input: { projectId: string; entityId: string; commit: string }
	): Promise<CommittedThread[]>;
}
export interface GitHubOptions {
	repository: RepositoryIdentity;
	token(input: {
		installationId: number;
		repositoryIds: number[];
		permissions: { contents: 'read' | 'write' };
	}): Promise<string>;
	fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}
export interface GitHubRepositoryOptions extends GitHubOptions {
	ref: string;
	path: string;
}
export interface SourceHistoryCommit {
	hash: string;
	subject: string;
	authoredAt: string;
}
export interface SourceHistoryPageInput {
	commit: string;
	paths: string[];
	page?: number;
	perPage?: number;
}
export interface SourceHistoryPage {
	commits: SourceHistoryCommit[];
	complete: boolean;
	nextPage: number | null;
}
export interface SourceHistoryAdapter extends SourceAdapter {
	/** Release only memoized bytes after sequential validation; commit/tree authority is unchanged. */
	releaseBytes?(repository: RepositoryIdentity, input: { commit: string; path: string }): void;
	rawMany?(
		repository: RepositoryIdentity,
		input: { commit: string; paths: string[] }
	): Promise<Map<string, Uint8Array>>;
	raw(repository: RepositoryIdentity, input: { commit: string; path: string }): Promise<Uint8Array>;
	historyPage?(
		repository: RepositoryIdentity,
		input: SourceHistoryPageInput
	): Promise<SourceHistoryPage>;
	branches(repository: RepositoryIdentity): Promise<Array<{ name: string; tip: string }>>;
	commits(
		repository: RepositoryIdentity,
		input: { branch: string; commit?: string }
	): Promise<Array<{ hash: string; subject: string; authoredAt: string }>>;
	changed(repository: RepositoryIdentity, commit: string): Promise<string[]>;
	optionalRef(repository: RepositoryIdentity, ref: string): Promise<SourceCommit | null>;
	/** The commit as the repository states it; null when it holds no such commit. */
	facts?(repository: RepositoryIdentity, commit: string): Promise<SourceCommitFacts | null>;
	/** True when `commit` is `tip` or one of its ancestors; false when either is not held. */
	reaches?(
		repository: RepositoryIdentity,
		input: { tip: string; commit: string }
	): Promise<boolean>;
}
