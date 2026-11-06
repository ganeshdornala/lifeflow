import { describe, expect, it } from "vitest";
import type { WorkflowStep } from "./workflow-step";
import {
    assessWorkflow,
    validateWorkflow,
    addWorkflowStep,
    updateWorkflowStep,
    updateStepPrerequisites,
    completeWorkflowStep,
    deleteWorkflowStep,
    assessWorkflowStep,
} from "./workflow-engine";

const createStep = (
    overrides: Partial<WorkflowStep> = {},
): WorkflowStep => ({
    id: "step-1",
    commitmentId: "commitment-1",
    title: "Test step",
    description: "",
    status: "pending",
    prerequisiteIds: [],
    dueDate: null,
    createdAt: "2026-11-05T10:00:00.000Z",
    updatedAt: "2026-11-05T10:00:00.000Z",
    ...overrides,
});

describe("validateWorkflow", () => {
    it("accepts an independent workflow", () => {
        expect(validateWorkflow([createStep()])).toEqual({
            valid: true,
        });
    });

    it("rejects an empty step title", () => {
        const steps = [createStep({ title: "" })];

        expect(validateWorkflow(steps)).toMatchObject({
            valid: false,
            reason: "invalid-title",
            stepId: "step-1",
        });
    });

    it("rejects a whitespace-only step title", () => {
        const steps = [createStep({ title: "   " })];

        expect(validateWorkflow(steps)).toMatchObject({
            valid: false,
            reason: "invalid-title",
            stepId: "step-1",
        });
    });

    it("accepts an empty optional description", () => {
        const steps = [createStep({ description: "" })];

        expect(validateWorkflow(steps)).toEqual({
            valid: true,
        });
    });

    it("accepts a non-empty description", () => {
        const steps = [
            createStep({ description: "Collect the required documents" }),
        ];

        expect(validateWorkflow(steps)).toEqual({
            valid: true,
        });
    });

    it("rejects a whitespace-only description", () => {
        const steps = [createStep({ description: "   " })];

        expect(validateWorkflow(steps)).toMatchObject({
            valid: false,
            reason: "invalid-description",
            stepId: "step-1",
        });
    });

    it("rejects duplicate step IDs", () => {
        const steps = [
            createStep({ id: "step-1" }),
            createStep({ id: "step-1" }),
        ];

        expect(validateWorkflow(steps)).toMatchObject({
            valid: false,
            reason: "duplicate-step-id",
        });
    });

    it("rejects duplicate prerequisites", () => {
        const steps = [
            createStep({ id: "step-1" }),
            createStep({
                id: "step-2",
                prerequisiteIds: ["step-1", "step-1"],
            }),
        ];

        expect(validateWorkflow(steps)).toMatchObject({
            valid: false,
            reason: "duplicate-prerequisite",
        });
    });

    it("rejects missing prerequisites", () => {
        const steps = [
            createStep({
                id: "step-2",
                prerequisiteIds: ["missing-step"],
            }),
        ];

        expect(validateWorkflow(steps)).toMatchObject({
            valid: false,
            reason: "missing-step",
        });
    });

    it("rejects self-dependencies", () => {
        const steps = [
            createStep({
                id: "step-1",
                prerequisiteIds: ["step-1"],
            }),
        ];

        expect(validateWorkflow(steps)).toMatchObject({
            valid: false,
            reason: "self-dependency",
        });
    });

    it("rejects cyclic dependencies", () => {
        const steps = [
            createStep({
                id: "step-1",
                prerequisiteIds: ["step-2"],
            }),
            createStep({
                id: "step-2",
                prerequisiteIds: ["step-1"],
            }),
        ];

        expect(validateWorkflow(steps)).toMatchObject({
            valid: false,
            reason: "cycle",
        });
    });

    it("accepts a valid dependency chain", () => {
        const steps = [
            createStep({ id: "step-1" }),
            createStep({
                id: "step-2",
                prerequisiteIds: ["step-1"],
            }),
            createStep({
                id: "step-3",
                prerequisiteIds: ["step-2"],
            }),
        ];

        expect(validateWorkflow(steps)).toEqual({
            valid: true,
        });
    });

    it("accepts independent parallel steps", () => {
        const steps = [
            createStep({ id: "step-1" }),
            createStep({ id: "step-2" }),
            createStep({
                id: "step-3",
                prerequisiteIds: ["step-1", "step-2"],
            }),
        ];

        expect(validateWorkflow(steps)).toEqual({
            valid: true,
        });
    });

    it("rejects steps belonging to different commitments", () => {
        const steps = [
            createStep({
                id: "step-1",
                commitmentId: "commitment-1",
            }),
            createStep({
                id: "step-2",
                commitmentId: "commitment-2",
            }),
        ];

        expect(validateWorkflow(steps)).toMatchObject({
            valid: false,
            reason: "mixed-commitment",
            stepId: "step-2",
        });
    });

    it("rejects invalid workflow step dates", () => {
        const steps = [
            createStep({
                id: "step-1",
                dueDate: "2026-02-30",
            }),
        ];

        expect(validateWorkflow(steps)).toMatchObject({
            valid: false,
            reason: "invalid-due-date",
            stepId: "step-1",
        });
    });

    it("accepts a valid workflow step date", () => {
        const steps = [
            createStep({
                id: "step-1",
                dueDate: "2026-11-05",
            }),
        ];

        expect(validateWorkflow(steps)).toEqual({
            valid: true,
        });
    });

    it("accepts a null workflow step date", () => {
        const steps = [
            createStep({
                id: "step-1",
                dueDate: null,
            }),
        ];

        expect(validateWorkflow(steps)).toEqual({
            valid: true,
        });
    });

    it("rejects a completed step with a pending prerequisite", () => {
        const steps = [
            createStep({ id: "step-1", status: "pending" }),
            createStep({
                id: "step-2",
                status: "completed",
                prerequisiteIds: ["step-1"],
            }),
        ];

        expect(validateWorkflow(steps)).toMatchObject({
            valid: false,
            reason: "completed-step-has-incomplete-prerequisite",
            stepId: "step-2",
            prerequisiteId: "step-1",
        });
    });

    it("rejects a completed step with a skipped prerequisite", () => {
        const steps = [
            createStep({ id: "step-1", status: "skipped" }),
            createStep({
                id: "step-2",
                status: "completed",
                prerequisiteIds: ["step-1"],
            }),
        ];

        expect(validateWorkflow(steps)).toMatchObject({
            valid: false,
            reason: "completed-step-has-incomplete-prerequisite",
            stepId: "step-2",
            prerequisiteId: "step-1",
        });
    });

    it("accepts a completed step when all prerequisites are completed", () => {
        const steps = [
            createStep({ id: "step-1", status: "completed" }),
            createStep({
                id: "step-2",
                status: "completed",
                prerequisiteIds: ["step-1"],
            }),
        ];

        expect(validateWorkflow(steps)).toEqual({ valid: true });
    });
});

describe("assessWorkflow", () => {
    it("marks independent pending steps as ready", () => {
        const steps = [createStep()];

        expect(assessWorkflow(steps)).toEqual([
            {
                stepId: "step-1",
                readiness: "ready",
                blockerIds: [],
            },
        ]);
    });

    it("blocks a step with unfinished prerequisites", () => {
        const steps = [
            createStep({ id: "step-1" }),
            createStep({
                id: "step-2",
                prerequisiteIds: ["step-1"],
            }),
        ];

        expect(assessWorkflow(steps)[1]).toEqual({
            stepId: "step-2",
            readiness: "blocked",
            blockerIds: ["step-1"],
        });
    });

    it("unblocks a step when its prerequisite is completed", () => {
        const steps = [
            createStep({
                id: "step-1",
                status: "completed",
            }),
            createStep({
                id: "step-2",
                prerequisiteIds: ["step-1"],
            }),
        ];

        expect(assessWorkflow(steps)[1]).toEqual({
            stepId: "step-2",
            readiness: "ready",
            blockerIds: [],
        });
    });

    it("keeps skipped prerequisites as blockers", () => {
        const steps = [
            createStep({
                id: "step-1",
                status: "skipped",
            }),
            createStep({
                id: "step-2",
                prerequisiteIds: ["step-1"],
            }),
        ];

        expect(assessWorkflow(steps)[1]).toEqual({
            stepId: "step-2",
            readiness: "blocked",
            blockerIds: ["step-1"],
        });
    });

    it("preserves completed step status", () => {
        const steps = [
            createStep({
                id: "step-1",
                status: "completed",
            }),
        ];

        expect(assessWorkflow(steps)[0].readiness).toBe("completed");
    });

    it("preserves skipped step status", () => {
        const steps = [
            createStep({
                id: "step-1",
                status: "skipped",
            }),
        ];

        expect(assessWorkflow(steps)[0].readiness).toBe("skipped");
    });

    it("reports multiple blockers", () => {
        const steps = [
            createStep({ id: "step-1" }),
            createStep({ id: "step-2" }),
            createStep({
                id: "step-3",
                prerequisiteIds: ["step-1", "step-2"],
            }),
        ];

        expect(assessWorkflow(steps)[2].blockerIds).toEqual([
            "step-1",
            "step-2",
        ]);
    });

    it("rejects invalid workflows before assessment", () => {
        const steps = [
            createStep({
                id: "step-1",
                prerequisiteIds: ["missing-step"],
            }),
        ];

        expect(() => assessWorkflow(steps)).toThrow(
            "Invalid workflow: missing-step at step step-1",
        );
    });

    it("rejects directly assessing a completed step with a pending prerequisite", () => {
        const prerequisite = createStep({
            id: "step-1",
            status: "pending",
        });

        const completedStep = createStep({
            id: "step-2",
            status: "completed",
            prerequisiteIds: ["step-1"],
        });

        const byId = new Map([
            [prerequisite.id, prerequisite],
            [completedStep.id, completedStep],
        ]);

        expect(() =>
            assessWorkflowStep(completedStep, byId),
        ).toThrow(
            "Cannot assess completed step step-2: unfinished prerequisites: step-1",
        );
    });
});

describe("workflow operations", () => {
    it("adds a valid step without mutating the original workflow", () => {
        const steps = [createStep({ id: "step-1" })];

        const updated = addWorkflowStep(
            createStep({ id: "step-2" }),
            steps,
        );

        expect(updated).toHaveLength(2);
        expect(steps).toHaveLength(1);
    });

    it("rejects adding a duplicate step ID", () => {
        const steps = [createStep({ id: "step-1" })];

        expect(() =>
            addWorkflowStep(createStep({ id: "step-1" }), steps),
        ).toThrow("duplicate-step-id");
    });

    it("rejects adding a step from another commitment", () => {
        const steps = [createStep({ id: "step-1" })];

        expect(() =>
            addWorkflowStep(
                createStep({
                    id: "step-2",
                    commitmentId: "commitment-2",
                }),
                steps,
            ),
        ).toThrow("mixed-commitment");
    });

    it("updates descriptive fields without mutating the original", () => {
        const steps = [createStep({ id: "step-1" })];

        const updated = updateWorkflowStep(
            "step-1",
            { title: "Updated title" },
            steps,
        );

        expect(updated[0].title).toBe("Updated title");
        expect(steps[0].title).toBe("Test step");
    });

    it("rejects updating an unknown step", () => {
        expect(() =>
            updateWorkflowStep("missing", { title: "New title" }, []),
        ).toThrow("Workflow step not found");
    });

    it("rejects editing a completed step", () => {
        const steps = [
            createStep({ id: "step-1", status: "completed" }),
        ];

        expect(() =>
            updateWorkflowStep(
                "step-1",
                { title: "Changed" },
                steps,
            ),
        ).toThrow("Only pending steps can be edited");
    });

    it("updates prerequisites when the resulting workflow is valid", () => {
        const steps = [
            createStep({ id: "step-1" }),
            createStep({ id: "step-2" }),
        ];

        const updated = updateStepPrerequisites(
            "step-2",
            ["step-1"],
            steps,
        );

        expect(updated[1].prerequisiteIds).toEqual(["step-1"]);
        expect(steps[1].prerequisiteIds).toEqual([]);
    });

    it("rejects prerequisite updates that introduce a cycle", () => {
        const steps = [
            createStep({ id: "step-1" }),
            createStep({
                id: "step-2",
                prerequisiteIds: ["step-1"],
            }),
        ];

        expect(() =>
            updateStepPrerequisites("step-1", ["step-2"], steps),
        ).toThrow("cycle");
    });

    it("completes a ready step", () => {
        const steps = [createStep({ id: "step-1" })];

        const updated = completeWorkflowStep("step-1", steps);

        expect(updated[0].status).toBe("completed");
        expect(steps[0].status).toBe("pending");
    });

    it("rejects completing a blocked step", () => {
        const steps = [
            createStep({ id: "step-1" }),
            createStep({
                id: "step-2",
                prerequisiteIds: ["step-1"],
            }),
        ];

        expect(() =>
            completeWorkflowStep("step-2", steps),
        ).toThrow("Unfinished prerequisites: step-1");
    });

    it("rejects completing a skipped step", () => {
        const steps = [
            createStep({ id: "step-1", status: "skipped" }),
        ];

        expect(() =>
            completeWorkflowStep("step-1", steps),
        ).toThrow("Cannot complete a skipped step");
    });

    it("allows completing an already completed step", () => {
        const steps = [
            createStep({ id: "step-1", status: "completed" }),
        ];

        const updated = completeWorkflowStep("step-1", steps);

        expect(updated[0].status).toBe("completed");
    });

    it("rejects completing an unknown step", () => {
        expect(() =>
            completeWorkflowStep("missing", []),
        ).toThrow("Workflow step not found");
    });

    it("rejects adding a step with an invalid date", () => {
        const steps = [createStep({ id: "step-1" })];

        expect(() =>
            addWorkflowStep(
                createStep({
                    id: "step-2",
                    dueDate: "2026-02-30",
                }),
                steps,
            ),
        ).toThrow("invalid-due-date");
    });

    it("rejects updating a step with an invalid date", () => {
        const steps = [createStep({ id: "step-1" })];

        expect(() =>
            updateWorkflowStep(
                "step-1",
                { dueDate: "2026-02-30" },
                steps,
            ),
        ).toThrow("Invalid due date");
    });

    it("deletes a step with no dependents", () => {
        const steps = [
            createStep({ id: "step-1" }),
            createStep({ id: "step-2" }),
        ];

        const result = deleteWorkflowStep("step-1", steps);

        expect(result.map((step) => step.id)).toEqual(["step-2"]);
        expect(steps).toHaveLength(2);
    });

    it("rejects deleting an unknown step", () => {
        const steps = [createStep({ id: "step-1" })];

        expect(() =>
            deleteWorkflowStep("unknown", steps),
        ).toThrow("Cannot delete unknown step: unknown");
    });

    it("rejects deleting a step with a pending dependent", () => {
        const steps = [
            createStep({ id: "step-1" }),
            createStep({
                id: "step-2",
                prerequisiteIds: ["step-1"],
            }),
        ];

        expect(() =>
            deleteWorkflowStep("step-1", steps),
        ).toThrow("step step-2 depends on it");
    });

    it("rejects deleting a completed step", () => {
        const steps: WorkflowStep[] = [
            {
                id: "step-1",
                commitmentId: "commitment-1",
                title: "First step",
                description: "",
                status: "completed",
                prerequisiteIds: [],
                dueDate: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
            },
        ];

        expect(() => deleteWorkflowStep("step-1", steps)).toThrow(
            "Only pending workflow steps can be deleted",
        );
    });

    it("does not mutate the original workflow when deleting", () => {
        const steps = [
            createStep({ id: "step-1" }),
            createStep({ id: "step-2" }),
        ];

        const originalFirstStep = steps[0];

        const result = deleteWorkflowStep("step-1", steps);

        expect(result).not.toBe(steps);
        expect(steps).toHaveLength(2);
        expect(steps[0]).toBe(originalFirstStep);
    });

    it("trims a non-empty description when adding a step", () => {
        const steps = [createStep({ id: "step-1" })];

        const updated = addWorkflowStep(
            createStep({
                id: "step-2",
                description: "  Collect documents  ",
            }),
            steps,
        );

        expect(updated[1].description).toBe("Collect documents");
    });

    it("allows an empty optional description when adding a step", () => {
        const steps = [createStep({ id: "step-1" })];

        const updated = addWorkflowStep(
            createStep({ id: "step-2", description: "" }),
            steps,
        );

        expect(updated[1].description).toBe("");
    });

    it("rejects a whitespace-only description when adding a step", () => {
        const steps = [createStep({ id: "step-1" })];

        expect(() =>
            addWorkflowStep(
                createStep({ id: "step-2", description: "   " }),
                steps,
            ),
        ).toThrow("Invalid workflow: invalid-description");
    });

    it("trims a non-empty description when updating a step", () => {
        const steps = [createStep({ id: "step-1" })];

        const updated = updateWorkflowStep(
            "step-1",
            { description: "  Collect documents  " },
            steps,
        );

        expect(updated[0].description).toBe("Collect documents");
    });

    it("allows an empty optional description when updating a step", () => {
        const steps = [
            createStep({
                id: "step-1",
                description: "Existing description",
            }),
        ];

        const updated = updateWorkflowStep(
            "step-1",
            { description: "" },
            steps,
        );

        expect(updated[0].description).toBe("");
    });

    it("rejects a whitespace-only description when updating a step", () => {
        const steps = [createStep({ id: "step-1" })];

        expect(() =>
            updateWorkflowStep(
                "step-1",
                { description: "   " },
                steps,
            ),
        ).toThrow("Invalid workflow: invalid-description");
    });
});