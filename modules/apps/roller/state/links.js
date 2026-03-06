/**
 * Linked-actor state relationship helpers.
 */

/**
 * Collect linked actor UUIDs for an actor.
 * @param {Actor} actor
 * @returns {Set<string>}
 */
export function getLinkedActorUuids(actor) {
	const linkedSet = new Set();
	if (!actor) return linkedSet;
	if (actor.uuid) linkedSet.add(actor.uuid);
	const linked = actor.system?.bio?.linkedActors?.value || [];
	for (const link of linked) {
		if (link?.uuid) linkedSet.add(link.uuid);
	}
	return linkedSet;
}

/**
 * Check if two actors are linked directly or indirectly.
 * @param {Actor} actorA
 * @param {Actor} actorB
 * @returns {boolean}
 */
export function areActorsLinked(actorA, actorB) {
	if (!actorA || !actorB) return false;
	const setA = getLinkedActorUuids(actorA);
	if (setA.has(actorB.uuid)) return true;
	const setB = getLinkedActorUuids(actorB);
	if (setB.has(actorA.uuid)) return true;
	for (const id of setA) {
		if (setB.has(id)) return true;
	}
	return false;
}
