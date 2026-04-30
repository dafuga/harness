interface TopicEntry {
	topic: string;
}

export function availableGuideTopics(entries: TopicEntry[]): string[] {
	return [...new Set(entries.map((entry) => entry.topic))];
}

export function findGuideByTopic<Guide extends TopicEntry>(
	guides: Guide[],
	topic: string
): Guide | undefined {
	const normalizedTopic = normalizeGuideTopic(guides, topic);
	return guides.find((guide) => guide.topic === normalizedTopic);
}

function normalizeGuideTopic(entries: TopicEntry[], topic: string): string {
	const normalizedTopic = topic.trim().toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-');
	const knownTopics = new Set(availableGuideTopics(entries));
	const match = topicCandidates(normalizedTopic).find((candidate) => knownTopics.has(candidate));

	return match ?? normalizedTopic;
}

function topicCandidates(topic: string): string[] {
	if (topic === 'scaffold') return [topic, 'scaffolds'];
	if (topic.endsWith('ies')) return [topic, `${topic.slice(0, -3)}y`];
	if (topic.endsWith('s')) return [topic, topic.slice(0, -1)];

	return [topic];
}
