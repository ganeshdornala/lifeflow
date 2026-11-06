import type {
    Commitment,
    CommitmentAssessment,
    CommitmentReadiness,
} from "./commitment";
import type { WorkflowStep } from "./workflow-step";
import { validateWorkflow } from "./workflow-engine";

export type DependencyGraph = Map<string, string[]>;

export type DependencyValidation =
    | { valid: true }
    | {
        valid: false;
        reason: "missing-commitment" | "self-dependency" | "cycle";
        commitmentId: string;
        prerequisiteId: string;
    }

function indexCommitments(
    commitments: readonly Commitment[],
): Map<string, Commitment> {
    const byId = new Map<string, Commitment>();
    for (const commitment of commitments) {
        if (byId.has(commitment.id)) {
            throw new Error(`Duplicate commitment ID: ${commitment.id}`);
        }
        byId.set(commitment.id, commitment);
    }
    return byId;
}

export function validateDependencyGraph(
    commitments: readonly Commitment[],
): DependencyValidation {
    const byId = indexCommitments(commitments);
    for (const commitment of commitments) {
        for (const prerequisiteId of commitment.prerequisiteIds) {
            if (!byId.has(prerequisiteId)) {
                return {
                    valid: false,
                    reason: "missing-commitment",
                    commitmentId: commitment.id,
                    prerequisiteId,
                };
            }
            if (prerequisiteId === commitment.id) {
                return {
                    valid: false,
                    reason: "self-dependency",
                    commitmentId: commitment.id,
                    prerequisiteId,
                };
            }
        }
    }

    const state = new Map<string, 0 | 1 | 2>();

    function visit(id: string): DependencyValidation {
        state.set(id, 1);

        const commitment = byId.get(id)!;

        for (const prerequisiteId of commitment.prerequisiteIds) {
            const prerequisiteState = state.get(prerequisiteId) ?? 0;
            if (prerequisiteState === 1) {
                return {
                    valid: false,
                    reason: "cycle",
                    commitmentId: id,
                    prerequisiteId,
                };
            }
            if (prerequisiteState === 0) {
                const result = visit(prerequisiteId);
                if (!result.valid) {
                    return result;
                }
            }
        }
        state.set(id, 2);
        return { valid: true };
    }

    for (const commitment of commitments) {
        if ((state.get(commitment.id) ?? 0) === 0) {
            const result = visit(commitment.id);
            if (!result.valid) {
                return result;
            }
        }
    }
    return { valid: true };
}

export function getDirectBlockerIds(
    commitment: Commitment,
    byId: ReadonlyMap<string, Commitment>,
): string[] {
    return commitment.prerequisiteIds.filter((id) => {
        const prerequisite = byId.get(id);
        return (
            !prerequisite ||
            prerequisite.lifecycle !== "completed"
        );
    });
}

export function assessCommitment(
    commitment: Commitment,
    byId: ReadonlyMap<string, Commitment>,
    today: string,
): CommitmentAssessment {
    let readiness: CommitmentReadiness;
    let blockerIds: string[] = [];
    if (commitment.lifecycle === "completed") {
        readiness = "completed";
    } else if (commitment.lifecycle === "cancelled") {
        readiness = "cancelled";
    } else {
        blockerIds = getDirectBlockerIds(commitment, byId);
        readiness = blockerIds.length > 0 ? "blocked" : "ready";
    }
    return {
        commitmentId: commitment.id,
        readiness,
        blockerIds,
        isOverdue:
            commitment.lifecycle === "open" &&
            commitment.dueDate !== null &&
            commitment.dueDate < today,
    };
}

export function assessAllCommitments(
    commitments: readonly Commitment[],
    today: string,
): CommitmentAssessment[] {
    const validation = validateDependencyGraph(commitments);
    if (!validation.valid) {
        throw new Error(
            `Invalid dependency graph: ${validation.reason} ` +
            `between ${validation.commitmentId} and ${validation.prerequisiteId}`,
        );
    }
    const byId = indexCommitments(commitments);
    return commitments.map((commitment) =>
        assessCommitment(commitment, byId, today),
    );
}

/**
 * Returns every unfinished prerequisite in the dependency chain.
 *
 * The returned IDs are unique and ordered by traversal.
 * Complexity: O(V + E).
 */
export function getTransitiveBlockerIds(
    commitmentId: string,
    byId: ReadonlyMap<string, Commitment>,
): string[] {
    const target = byId.get(commitmentId);
    if (!target) {
        throw new Error(`Unknown commitment ID: ${commitmentId}`);
    }
    const blockers = new Set<string>();
    const visited = new Set<string>();
    const stack = [...target.prerequisiteIds];
    while (stack.length > 0) {
        const currentId = stack.pop()!;
        if (visited.has(currentId)) {
            continue;
        }
        visited.add(currentId);
        const current = byId.get(currentId);
        if (!current) {
            throw new Error(`Unknown prerequisite ID: ${currentId}`);
        }
        if (current.lifecycle !== "completed") {
            blockers.add(currentId);
            stack.push(...current.prerequisiteIds);
        }
    }
    return [...blockers];
}

/**
 * Returns all unfinished commitments that directly or indirectly
 * depend on the given commitment.
 *
 * Cancelled and completed dependents are excluded because they
 * no longer represent active downstream work.
 *
 * Complexity: O(V + E).
 */
export function getDownstreamImpactIds(
    commitmentId: string,
    commitments: readonly Commitment[],
): string[] {
    const byId = indexCommitments(commitments);
    if (!byId.has(commitmentId)) {
        throw new Error(`Unknown commitment ID: ${commitmentId}`);
    }
    const dependents = new Map<string, string[]>();
    for (const commitment of commitments) {
        for (const prerequisiteId of commitment.prerequisiteIds) {
            const existing = dependents.get(prerequisiteId) ?? [];
            existing.push(commitment.id);
            dependents.set(prerequisiteId, existing);
        }
    }
    const visited = new Set<string>([commitmentId]);
    const queue: string[] = [commitmentId];
    const result: string[] = [];
    for (let head = 0; head < queue.length; head++) {
        const currentId = queue[head];
        for (const dependentId of dependents.get(currentId) ?? []) {
            if (visited.has(dependentId)) {
                continue;
            }
            visited.add(dependentId);
            const dependent = byId.get(dependentId)!;
            if (dependent.lifecycle === "open") {
                result.push(dependentId);
                queue.push(dependentId);
            }
        }
    }
    return result;
}

/**
 * Returns a new commitment with updated prerequisites,
 * provided the resulting dependency graph remains valid.
 *
 * The original commitment is never mutated.
 *
 * Complexity: O(V + E).
 */
export function updatePrerequisites(
    commitmentId: string,
    prerequisiteIds: string[],
    commitments: readonly Commitment[],
): Commitment[] {
    const byId = indexCommitments(commitments);
    const target = byId.get(commitmentId);
    if (!target) {
        throw new Error(`Unknown commitment ID: ${commitmentId}`);
    }
    // Reject duplicate prerequisite references.
    if (new Set(prerequisiteIds).size !== prerequisiteIds.length) {
        throw new Error("Duplicate prerequisite IDs are not allowed");
    }
    const updatedCommitments = commitments.map((commitment) =>
        commitment.id === commitmentId
            ? {
                ...commitment,
                prerequisiteIds: [...prerequisiteIds],
                updatedAt: new Date().toISOString(),
            }
            : commitment,
    );
    const validation = validateDependencyGraph(updatedCommitments);
    if (!validation.valid) {
        throw new Error(`Invalid dependency update: ${validation.reason} ` +
            `between ${validation.commitmentId} and ${validation.prerequisiteId}`,
        );
    }
    return updatedCommitments;
}

/**
 * Completes a commitment only when:
 * 1. All commitment prerequisites are completed.
 * 2. All its workflow steps are completed.
 * 3. Its intended outcome is verified as achieved.
 *
 * The original commitments and workflow steps are never mutated.
 */
export function completeCommitment(
    commitmentId: string,
    commitments: readonly Commitment[],
    workflowSteps: readonly WorkflowStep[],
): Commitment[] {
    const validation = validateDependencyGraph(commitments);

    if (!validation.valid) {
        throw new Error(
            `Invalid dependency graph: ${validation.reason} ` +
            `between ${validation.commitmentId} and ${validation.prerequisiteId}`,
        );
    }

    const byId = indexCommitments(commitments);
    const target = byId.get(commitmentId);

    if (!target) {
        throw new Error(`Unknown commitment ID: ${commitmentId}`);
    }

    if (target.lifecycle === "completed") {
        return [...commitments];
    }

    if (target.lifecycle === "cancelled") {
        throw new Error("A cancelled commitment cannot be completed");
    }

    // Check commitment-level prerequisites.
    const blockerIds = getDirectBlockerIds(target, byId);

    if (blockerIds.length > 0) {
        throw new Error(
            `Cannot complete commitment. Unfinished prerequisites: ${blockerIds.join(", ")}`,
        );
    }

    // Ensure all supplied steps belong to the target commitment.
    const hasForeignSteps = workflowSteps.some(
        (step) => step.commitmentId !== commitmentId,
    );

    if (hasForeignSteps) {
        throw new Error(
            "Workflow steps must belong to the target commitment",
        );
    }

    // Validate the target commitment's workflow.
    const workflowValidation = validateWorkflow(workflowSteps);

    if (!workflowValidation.valid) {
        throw new Error(
            `Invalid workflow: ${workflowValidation.reason} at step ${workflowValidation.stepId}`,
        );
    }

    // Every workflow step must be completed.
    const unfinishedSteps = workflowSteps.filter(
        (step) => step.status !== "completed",
    );

    if (unfinishedSteps.length > 0) {
        throw new Error(
            `Cannot complete commitment. Unfinished workflow steps: ${unfinishedSteps.map((step) => step.id).join(", ")
            }`,
        );
    }

    // Verify the intended outcome separately from performed actions.
    if (target.outcomeVerification.status !== "achieved") {
        throw new Error(
            "Cannot complete commitment. Outcome must be verified as achieved",
        );
    }

    return commitments.map((commitment) =>
        commitment.id === commitmentId
            ? {
                ...commitment,
                lifecycle: "completed" as const,
                updatedAt: new Date().toISOString(),
            }
            : commitment,
    );
}