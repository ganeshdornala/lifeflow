import type {
    WorkflowStep,
    WorkflowStepAssessment
} from "./workflow-step";
import { isValidDateOnly } from "./date";

export type WorkflowValidation =
    | { valid: true }
    | {
        valid: false;
        reason:
        | "duplicate-step-id"
        | "duplicate-prerequisite"
        | "missing-step"
        | "self-dependency"
        | "cycle"
        | "mixed-commitment"
        | "invalid-due-date"
        | "invalid-title"
        | "invalid-description"
        | "completed-step-has-incomplete-prerequisite";
        stepId: string;
        prerequisiteId?: string;
    };

function indexSteps(steps: readonly WorkflowStep[],): Map<string, WorkflowStep> {
    const byId = new Map<string, WorkflowStep>();
    for (const step of steps) {
        if (byId.has(step.id)) {
            throw new Error(`Duplicate workflow step ID: ${step.id}`);
        }
        byId.set(step.id, step);
    }
    return byId;
}

export function validateWorkflow(
    steps: readonly WorkflowStep[],
): WorkflowValidation {
    const byId = new Map<string, WorkflowStep>();
    for (const step of steps) {
        if (byId.has(step.id)) {
            return {
                valid: false,
                reason: "duplicate-step-id",
                stepId: step.id,
            };
        }
        byId.set(step.id, step);
    }
    // Every step in this workflow must belong to one commitment.
    const commitmentId = steps[0]?.commitmentId;
    for (const step of steps) {
        if (step.commitmentId !== commitmentId) {
            return {
                valid: false,
                reason: "mixed-commitment",
                stepId: step.id,
            };
        }
    }
    // Every workflow step must have a non-empty title.
    for(const step of steps) {
        if(typeof step.title !== "string" || step.title.trim().length === 0) {
            return {
                valid: false,
                reason: "invalid-title",
                stepId: step.id,
            };
        }
    }
    // Descriptions are optional, but must not contain whitespace only.
    for(const step of steps) {
        if(
            typeof step.description !== "string" ||
            (step.description.length>0 && step.description.trim().length===0) 
        ) {
            return {
                valid: false,
                reason: "invalid-description",
                stepId: step.id,
            };
        }
    }
    // Every non-null due date must be a valid YYYY-MM-DD date.
    for (const step of steps) {
        if (
            step.dueDate !== null &&
            !isValidDateOnly(step.dueDate)
        ) {
            return {
                valid: false,
                reason: "invalid-due-date",
                stepId: step.id,
            };
        }
    }
    for (const step of steps) {
        const seen = new Set<string>();
        for (const prerequisiteId of step.prerequisiteIds) {
            if (seen.has(prerequisiteId)) {
                return {
                    valid: false,
                    reason: "duplicate-prerequisite",
                    stepId: step.id,
                    prerequisiteId,
                };
            }
            seen.add(prerequisiteId);
            if (prerequisiteId === step.id) {
                return {
                    valid: false,
                    reason: "self-dependency",
                    stepId: step.id,
                    prerequisiteId,
                };
            }
            if (!byId.has(prerequisiteId)) {
                return {
                    valid: false,
                    reason: "missing-step",
                    stepId: step.id,
                    prerequisiteId,
                };
            }
        }
    }
    // A completed step must have all prerequisites completed.
    for (const step of steps) {
        if (step.status !== "completed") continue;
        for (const prerequisiteId of step.prerequisiteIds) {
            const prerequisite = byId.get(prerequisiteId)!;
            if (prerequisite.status !== "completed") {
                return {
                    valid: false,
                    reason: "completed-step-has-incomplete-prerequisite",
                    stepId: step.id,
                    prerequisiteId,
                };
            }
        }
    }
    // 0 = unvisited, 1 = visiting, 2 = visited.
    const state = new Map<string, 0 | 1 | 2>();
    function hasCycle(stepId: string): boolean {
        state.set(stepId, 1);
        const step = byId.get(stepId)!;
        for (const prerequisiteId of step.prerequisiteIds) {
            const prerequisiteState = state.get(prerequisiteId) ?? 0;
            if (prerequisiteState === 1) return true;
            if (
                prerequisiteState === 0 &&
                hasCycle(prerequisiteId)
            ) {
                return true;
            }
        }
        state.set(stepId, 2);
        return false;
    }
    for (const step of steps) {
        if ((state.get(step.id) ?? 0) === 0 && hasCycle(step.id)) {
            return {
                valid: false,
                reason: "cycle",
                stepId: step.id,
            };
        }
    }
    return { valid: true };
}

export function assessWorkflowStep(
    step: WorkflowStep,
    byId: ReadonlyMap<string, WorkflowStep>,
): WorkflowStepAssessment {
    if (step.status === "completed") {
        const blockerIds = step.prerequisiteIds.filter(
            (id) => byId.get(id)?.status !== "completed",
        );
        if (blockerIds.length > 0) {
            throw new Error(
                `Cannot assess completed step ${step.id}: unfinished prerequisites: ${blockerIds.join(", ")}`,
            );
        }
        return {
            stepId: step.id,
            readiness: "completed",
            blockerIds: [],
        };
    }
    if (step.status === "skipped") {
        return {
            stepId: step.id,
            readiness: "skipped",
            blockerIds: [],
        };
    }
    const blockerIds = step.prerequisiteIds.filter(
        (id) => byId.get(id)?.status !== "completed",
    );
    return {
        stepId: step.id,
        readiness: blockerIds.length > 0 ? "blocked" : "ready",
        blockerIds,
    };
}

export function assessWorkflow(
    steps: readonly WorkflowStep[],
): WorkflowStepAssessment[] {
    const validation = validateWorkflow(steps);
    if (!validation.valid) {
        throw new Error(
            `Invalid workflow: ${validation.reason} at step ${validation.stepId}`,
        );
    }
    const byId = indexSteps(steps);
    return steps.map((step) => assessWorkflowStep(step, byId));
}

/**
 * Adds a step without mutating the original workflow.
 */
export function addWorkflowStep(
    newStep: WorkflowStep,
    steps: readonly WorkflowStep[],
): WorkflowStep[] {
    const candidateSteps = [...steps, newStep];
    const validation = validateWorkflow(candidateSteps);
    if (!validation.valid) {
        throw new Error(
            `Invalid workflow: ${validation.reason}`
        );
    }
    const normalizedStep: WorkflowStep = {
        ...newStep,
        description: newStep.description.trim(),
    };
    return [...steps, normalizedStep];
}

/**
 * Updates descriptive fields only.
 * Status and dependencies have dedicated operations.
 */
export function updateWorkflowStep(
    stepId: string,
    updates: Partial<
        Pick<WorkflowStep, "title" | "description" | "dueDate">
    >,
    steps: readonly WorkflowStep[],
): WorkflowStep[] {
    const existing = steps.find((step) => step.id === stepId);
    if (!existing) {
        throw new Error(`Workflow step not found: ${stepId}`);
    }
    if (existing.status !== "pending") {
        throw new Error("Only pending steps can be edited");
    }
    if (
        updates.dueDate !== undefined &&
        updates.dueDate !== null &&
        !isValidDateOnly(updates.dueDate)
    ) {
        throw new Error(`Invalid due date: ${updates.dueDate}`);
    }
    // Validate the raw input before normalizing it.
    const candidateSteps = steps.map((step) =>
        step.id === stepId
        ? {
            ...step,
            ...updates,
            updatedAt: new Date().toISOString(),
        }
        : step,
    );
    const validation = validateWorkflow(candidateSteps);
    if(!validation.valid) {
        throw new Error(`Invalid workflow: ${validation.reason}`);
    }
    // Normalize only after successful validation.
    return candidateSteps.map((step) =>
        step.id === stepId && updates.description !== undefined
        ? {
            ...step,
            description: step.description.trim(),
        }
        : step,
    );
}

/**
 * Changes prerequisites and validates the resulting graph.
 */
export function updateStepPrerequisites(
    stepId: string,
    prerequisiteIds: string[],
    steps: readonly WorkflowStep[],
): WorkflowStep[] {
    const existing = steps.find((step) => step.id === stepId);
    if (!existing) {
        throw new Error(`Workflow step not found: ${stepId}`);
    }
    if (existing.status !== "pending") {
        throw new Error("Only pending steps can change prerequisites");
    }
    const updatedSteps = steps.map((step) =>
        step.id === stepId
            ? {
                ...step,
                prerequisiteIds: [...prerequisiteIds],
                updatedAt: new Date().toISOString(),
            }
            : step,
    );
    const validation = validateWorkflow(updatedSteps);
    if (!validation.valid) {
        throw new Error(
            `Cannot update prerequisites: ${validation.reason} at step ${validation.stepId}`,
        );
    }
    return updatedSteps;
}

/**
 * Completes a pending step only when all its prerequisites
 * have been completed.
 */
export function completeWorkflowStep(
    stepId: string,
    steps: readonly WorkflowStep[],
): WorkflowStep[] {
    const validation = validateWorkflow(steps);
    if (!validation.valid) {
        throw new Error(
            `Invalid workflow: ${validation.reason} at step ${validation.stepId}`,
        );
    }
    const existing = steps.find((step) => step.id === stepId);
    if (!existing) {
        throw new Error(`Workflow step not found: ${stepId}`);
    }
    if (existing.status === "completed") {
        return [...steps];
    }
    if (existing.status === "skipped") {
        throw new Error("Cannot complete a skipped step");
    }
    const byId = indexSteps(steps);
    const assessment = assessWorkflowStep(existing, byId);
    if (assessment.readiness === "blocked") {
        throw new Error(
            `Cannot complete step. Unfinished prerequisites: ${assessment.blockerIds.join(", ")}`,
        );
    }
    return steps.map((step) =>
        step.id === stepId
            ? {
                ...step,
                status: "completed",
                updatedAt: new Date().toISOString(),
            }
            : step,
    );
}

export function deleteWorkflowStep(
    stepId: string,
    steps: readonly WorkflowStep[],
): WorkflowStep[] {
    const validation = validateWorkflow(steps);

    if (!validation.valid) {
        throw new Error(
            `Cannot delete step: ${validation.reason} at step ${validation.stepId}`,
        );
    }

    const target = steps.find((step) => step.id === stepId);

    if (!target) {
        throw new Error(`Cannot delete unknown step: ${stepId}`);
    }

    // Preserve completed actions as part of the execution history.
    if (target.status !== "pending") {
        throw new Error("Only pending workflow steps can be deleted");
    }

    // Prevent deletion when another step depends on this step.
    const dependentStep = steps.find((step) =>
        step.prerequisiteIds.includes(stepId),
    );

    if (dependentStep) {
        throw new Error(
            `Cannot delete step ${stepId}: step ${dependentStep.id} depends on it`,
        );
    }

    return steps.filter((step) => step.id !== stepId);
}