import { createUnverifiedOutcome } from "./outcome-verification";
import { describe, expect, it } from "vitest";
import type { Commitment } from "./commitment";
import {
    assessAllCommitments,
    validateDependencyGraph,
    getTransitiveBlockerIds,
    getDownstreamImpactIds,
    completeCommitment,
    updatePrerequisites,
} from "./dependency-engine";
import type { WorkflowStep } from "./workflow-step";
import { recordOutcomeVerification } from "./outcome-verification";

const today = "2026-10-28";

function createCommitment(
    overrides: Partial<Commitment> & Pick<Commitment, "id" | "title">,
): Commitment {
    return {
        description: "",
        category: "personal",
        dueDate: null,
        priority: "medium",
        lifecycle: "open",
        prerequisiteIds: [],
        outcomeVerification: createUnverifiedOutcome(),
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        ...overrides,
    };
}

function createWorkflowStep(
    overrides: Partial<WorkflowStep> &
        Pick<WorkflowStep, "id" | "commitmentId" | "title">,
): WorkflowStep {
    return {
        description: "",
        status: "pending",
        prerequisiteIds: [],
        dueDate: null,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        ...overrides,
    };
}

describe("dependency engine", () => {
    it("marks a commitment without prerequisites as ready", () => {
        const items = [
            createCommitment({ id: "a", title: "Renew insurance" }),
        ];

        expect(assessAllCommitments(items, today)[0]).toMatchObject({
            readiness: "ready",
            blockerIds: [],
            isOverdue: false,
        });
    });

    it("blocks a commitment when its prerequisite is open", () => {
        const items = [
            createCommitment({ id: "a", title: "Get updated terms" }),
            createCommitment({
                id: "b",
                title: "Renew agreement",
                prerequisiteIds: ["a"],
            }),
        ];

        expect(assessAllCommitments(items, today)[1]).toMatchObject({
            readiness: "blocked",
            blockerIds: ["a"],
        });
    });

    it("unblocks a commitment when its prerequisite is completed", () => {
        const items = [
            createCommitment({
                id: "a",
                title: "Get updated terms",
                lifecycle: "completed",
            }),
            createCommitment({
                id: "b",
                title: "Renew agreement",
                prerequisiteIds: ["a"],
            }),
        ];

        expect(assessAllCommitments(items, today)[1].readiness).toBe("ready");
    });

    it("detects circular dependencies", () => {
        const items = [
            createCommitment({
                id: "a",
                title: "First",
                prerequisiteIds: ["b"],
            }),
            createCommitment({
                id: "b",
                title: "Second",
                prerequisiteIds: ["a"],
            }),
        ];

        expect(validateDependencyGraph(items)).toMatchObject({
            valid: false,
            reason: "cycle",
        });
    });

    it("rejects missing prerequisites", () => {
        const items = [
            createCommitment({
                id: "a",
                title: "Renew insurance",
                prerequisiteIds: ["missing"],
            }),
        ];

        expect(validateDependencyGraph(items)).toMatchObject({
            valid: false,
            reason: "missing-commitment",
        });
    });

    it("rejects self-dependencies", () => {
        const items = [
            createCommitment({
                id: "a",
                title: "Renew insurance",
                prerequisiteIds: ["a"],
            }),
        ];

        expect(validateDependencyGraph(items)).toMatchObject({
            valid: false,
            reason: "self-dependency",
        });
    });

    it("detects overdue open commitments", () => {
        const items = [
            createCommitment({
                id: "a",
                title: "Submit application",
                dueDate: "2026-10-27",
            }),
        ];

        expect(assessAllCommitments(items, today)[0].isOverdue).toBe(true);
    });

    it("does not mark a commitment due today as overdue", () => {
        const items = [
            createCommitment({
                id: "a",
                title: "Submit application",
                dueDate: today,
            }),
        ];

        expect(assessAllCommitments(items, today)[0].isOverdue).toBe(false);
    });


    it("finds transitive blockers", () => {
        const items = [
            createCommitment({ id: "a", title: "Get documents" }),
            createCommitment({
                id: "b",
                title: "Review documents",
                prerequisiteIds: ["a"],
            }),
            createCommitment({
                id: "c",
                title: "Submit application",
                prerequisiteIds: ["b"],
            }),
        ];

        const byId = new Map(items.map((item) => [item.id, item]));

        expect(getTransitiveBlockerIds("c", byId)).toEqual([
            "b",
            "a",
        ]);
    });

    it("finds all downstream commitments", () => {
        const items = [
            createCommitment({ id: "a", title: "Get documents" }),
            createCommitment({
                id: "b",
                title: "Review documents",
                prerequisiteIds: ["a"],
            }),
            createCommitment({
                id: "c",
                title: "Submit application",
                prerequisiteIds: ["b"],
            }),
            createCommitment({
                id: "d",
                title: "Pay application fee",
                prerequisiteIds: ["a"],
            }),
        ];

        expect(getDownstreamImpactIds("a", items)).toEqual([
            "b",
            "d",
            "c",
        ]);
    });

    it("excludes completed downstream commitments", () => {
        const items = [
            createCommitment({ id: "a", title: "Get documents" }),
            createCommitment({
                id: "b",
                title: "Review documents",
                prerequisiteIds: ["a"],
                lifecycle: "completed",
            }),
        ];

        expect(getDownstreamImpactIds("a", items)).toEqual([]);
    });

    it("returns an empty impact list when no commitments depend on it", () => {
        const items = [
            createCommitment({ id: "a", title: "Renew insurance" }),
            createCommitment({ id: "b", title: "Book appointment" }),
        ];

        expect(getDownstreamImpactIds("a", items)).toEqual([]);
    });

    it("updates prerequisites when the resulting graph is valid", () => {
        const commitments = [
            createCommitment({ id: "a", title: "A" }),
            createCommitment({ id: "b", title: "B" }),
        ];

        const updated = updatePrerequisites("b", ["a"], commitments);

        expect(updated.find((item) => item.id === "b")?.prerequisiteIds)
            .toEqual(["a"]);

        // Original data must remain unchanged.
        expect(commitments.find((item) => item.id === "b")?.prerequisiteIds)
            .toEqual([]);
    });

    it("rejects prerequisite updates that introduce a cycle", () => {
        const commitments = [
            createCommitment({ id: "a", title: "A", prerequisiteIds: ["b"] }),
            createCommitment({ id: "b", title: "B" }),
        ];

        expect(() =>
            updatePrerequisites("b", ["a"], commitments),
        ).toThrow(/cycle/);
    });

    it("rejects duplicate prerequisite IDs", () => {
        const commitments = [
            createCommitment({ id: "a", title: "A" }),
            createCommitment({ id: "b", title: "B" }),
        ];

        expect(() =>
            updatePrerequisites("b", ["a", "a"], commitments),
        ).toThrow(/Duplicate prerequisite IDs/);
    });

    it("completes a commitment when prerequisites, workflow, and outcome are satisfied", () => {
        const commitments = [
            createCommitment({
                id: "a",
                title: "A",
                lifecycle: "completed",
            }),
            createCommitment({
                id: "b",
                title: "B",
                prerequisiteIds: ["a"],
                outcomeVerification: recordOutcomeVerification(
                    "achieved",
                    "direct-observation",
                ),
            }),
        ];

        const workflowSteps = [
            createWorkflowStep({
                id: "step-1",
                commitmentId: "b",
                title: "Complete required action",
                status: "completed",
            }),
        ];

        const updated = completeCommitment("b", commitments, workflowSteps);

        expect(updated.find((item) => item.id === "b")?.lifecycle)
            .toBe("completed");

        expect(commitments.find((item) => item.id === "b")?.lifecycle)
            .toBe("open");
    });

    it("rejects completion when commitment prerequisites are unfinished", () => {
        const commitments = [
            createCommitment({ id: "a", title: "A" }),
            createCommitment({
                id: "b",
                title: "B",
                prerequisiteIds: ["a"],
                outcomeVerification: recordOutcomeVerification(
                    "achieved",
                    "direct-observation",
                ),
            }),
        ];

        expect(() =>
            completeCommitment("b", commitments, []),
        ).toThrow(/Unfinished prerequisites/);
    });

    it("rejects completion when the outcome is unverified", () => {
        const commitments = [
            createCommitment({ id: "a", title: "A" }),
        ];

        expect(() =>
            completeCommitment("a", commitments, []),
        ).toThrow(/Outcome must be verified as achieved/);
    });

    it("rejects completion when the outcome was not achieved", () => {
        const commitments = [
            createCommitment({
                id: "a",
                title: "A",
                outcomeVerification: recordOutcomeVerification(
                    "not-achieved",
                    "external-confirmation",
                    "Application rejected",
                ),
            }),
        ];

        expect(() =>
            completeCommitment("a", commitments, []),
        ).toThrow(/Outcome must be verified as achieved/);
    });

    it("rejects completion when workflow steps are unfinished", () => {
        const commitments = [
            createCommitment({
                id: "a",
                title: "A",
                outcomeVerification: recordOutcomeVerification(
                    "achieved",
                    "direct-observation",
                ),
            }),
        ];

        const workflowSteps = [
            createWorkflowStep({
                id: "step-1",
                commitmentId: "a",
                title: "Complete first action",
                status: "completed",
            }),
            createWorkflowStep({
                id: "step-2",
                commitmentId: "a",
                title: "Complete second action",
                status: "pending",
            }),
        ];

        expect(() =>
            completeCommitment("a", commitments, workflowSteps),
        ).toThrow(/Unfinished workflow steps: step-2/);
    });

    it("rejects completion when a workflow step is skipped", () => {
        const commitments = [
            createCommitment({
                id: "a",
                title: "A",
                outcomeVerification: recordOutcomeVerification(
                    "achieved",
                    "direct-observation",
                ),
            }),
        ];

        const workflowSteps = [
            createWorkflowStep({
                id: "step-1",
                commitmentId: "a",
                title: "Skipped action",
                status: "skipped",
            }),
        ];

        expect(() =>
            completeCommitment("a", commitments, workflowSteps),
        ).toThrow(/Unfinished workflow steps/);
    });

    it("allows completion without workflow steps when the outcome is achieved", () => {
        const commitments = [
            createCommitment({
                id: "a",
                title: "A",
                outcomeVerification: recordOutcomeVerification(
                    "achieved",
                    "direct-observation",
                ),
            }),
        ];

        const updated = completeCommitment("a", commitments, []);

        expect(updated.find((item) => item.id === "a")?.lifecycle)
            .toBe("completed");
    });

    it("rejects completion of a cancelled commitment", () => {
        const commitments = [
            createCommitment({
                id: "a",
                title: "A",
                lifecycle: "cancelled",
            }),
        ];

        expect(() =>
            completeCommitment("a", commitments, []),
        ).toThrow(/cancelled commitment/);
    });

    it("allows completing an already completed commitment without changing it", () => {
        const commitments = [
            createCommitment({
                id: "a",
                title: "A",
                lifecycle: "completed",
            }),
        ];

        const updated = completeCommitment("a", commitments, []);

        expect(updated).toEqual(commitments);
    });

});
