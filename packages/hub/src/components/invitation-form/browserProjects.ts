import type { Invitation } from "collaboration";

/** The link an owner hands over. It holds two identifiers; the code travels apart from it. */
export function invitationLink(origin: string, invitation: Invitation): string {
	const { projectId, id } = invitation;
	return `${origin}/invite/${encodeURIComponent(projectId)}/${encodeURIComponent(id)}`;
}
