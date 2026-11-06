export type OutcomeVerificationMethod =
    | "direct-observation"
    | "external-confirmation"
    | "document";

export type OutcomeVerification =
    | {
        status: "unverified";
        method: null;
        verifiedAt: null;
        notes: string;
    }
    | {
        status: "achieved" | "not-achieved";
        method: OutcomeVerificationMethod;
        verifiedAt: string;
        notes: string;
    };

export function createUnverifiedOutcome(): OutcomeVerification {
    return {
        status: "unverified",
        method: null,
        verifiedAt: null,
        notes: "",
    };
}

export function recordOutcomeVerification(
    status: "achieved" | "not-achieved",
    method: OutcomeVerificationMethod,
    notes = "",
    verifiedAt = new Date().toISOString(),
): OutcomeVerification {
    if(!Number.isFinite(Date.parse(verifiedAt))) {
        throw new Error("Invalid verification timestamp");
    }
    return {
        status,
        method,
        verifiedAt,
        notes: notes.trim(),
    };
}

export function isOutcomeAchieved(
    outcome: OutcomeVerification,
): boolean {
    return outcome.status === "achieved";
}