export function shouldInheritLinkedActorModifiers(actor) {
    return ["power", "stand"].includes(String(actor?.type || "").toLowerCase());
}

export function safeFromUuidSync(uuid) {
    if (typeof uuid !== "string" || !uuid) return null;

    try {
        return fromUuidSync(uuid);
    } catch (_error) {
        const tokenUuid = uuid.replace(/\.Actor\.[^.]+$/u, "");
        if (tokenUuid === uuid) return null;

        try {
            return fromUuidSync(tokenUuid);
        } catch (_nestedError) {
            return null;
        }
    }
}

export function getSceneTokenSourceForActor(actor, fallbackName = "") {
    if (!actor?.id) return null;
    const token = canvas?.tokens?.placeables?.find(placeable => placeable?.actor?.id === actor.id);
    if (!token?.document || !token.actor) return null;

    return {
        sourceUuid: token.document.uuid,
        actorId: token.actor.id,
        name: token.name || token.document.name || token.actor.name || fallbackName
    };
}

export function resolveLinkedActorSource(uuid, fallbackName = "") {
    const doc = safeFromUuidSync(uuid);
    const actor = doc?.actor || (doc?.documentName === "Actor" ? doc : null);
    if (!actor) return null;

    return getSceneTokenSourceForActor(actor, fallbackName) || {
        sourceUuid: actor.uuid,
        actorId: actor.id,
        name: fallbackName || actor.name
    };
}

/**
 * Resolve actor from sourceUuid+actorId with priority fallback.
 * @param {Object} source - { sourceUuid?, actorId? }
 * @returns {Actor|null}
 */
export function resolveActorFromSource({ sourceUuid, actorId }) {
    if (sourceUuid) {
        const doc = safeFromUuidSync(sourceUuid);
        if (doc) {
            if (doc.actor) return doc.actor;
            if (doc.documentName === "Actor") return doc;
        }
    }
    if (actorId) {
        return game.actors.get(actorId);
    }
    return null;
}

export function getRollableActorSources({ user = game.user, warnOnFail = false, hardStopOnFail = false } = {}) {
    if (user.isGM) {
        const highlighted = canvas.tokens.controlled
            .map(t => {
                const actor = t.actor;
                if (!actor) return null;
                return {
                    sourceUuid: t.document.uuid,
                    actorId: actor.id,
                    name: t.name
                };
            })
            .filter(s => s);

        if (!highlighted.length) {
            if (warnOnFail) ui.notifications.warn("No tokens highlighted. Please highlight tokens to prepare rolls.");
            if (hardStopOnFail) return null;
            return [];
        }

        const linked = highlighted.flatMap((source) => {
            const actor = resolveActorFromSource(source);
            if (!actor) return [];
            const linkedActors = actor.system.bio.linkedActors.value || [];
            return linkedActors
                .map((entry) => {
                    const uuid = entry?.uuid;
                    if (typeof uuid !== "string") return null;
                    return resolveLinkedActorSource(uuid, entry.name);
                })
                .filter(s => s);
        });

        const all = [...highlighted, ...linked];
        const seen = new Set();
        return all.filter(s => {
            if (seen.has(s.sourceUuid)) return false;
            seen.add(s.sourceUuid);
            return true;
        });
    }

    const owned = game.actors.filter(a => a.isOwner).map(a => ({
        sourceUuid: a.uuid,
        actorId: a.id,
        name: a.name
    }));

    if (!owned.length) {
        if (warnOnFail) ui.notifications.warn("No owned actors. Please ask your GM to assign you ownership of an actor to prepare rolls.");
        if (hardStopOnFail) return null;
        return [];
    }

    const linked = owned.flatMap((source) => {
        const actor = game.actors.get(source.actorId);
        if (!actor) return [];
        const linkedActors = actor.system.bio.linkedActors.value || [];
        return linkedActors
            .map((entry) => {
                const uuid = entry?.uuid;
                if (typeof uuid !== "string") return null;
                return resolveLinkedActorSource(uuid, entry.name);
            })
            .filter(s => s);
    });

    const all = [...owned, ...linked];
    const seen = new Set();
    return all.filter(s => {
        if (seen.has(s.sourceUuid)) return false;
        seen.add(s.sourceUuid);
        return true;
    });
}
