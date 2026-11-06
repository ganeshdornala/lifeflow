import { describe, expect, it } from "vitest";
import type { Commitment } from "./commitment";
import { rankActionableCommitments } from "./prioritization-engine";
import { createUnverifiedOutcome } from "./outcome-verification";

const today = "2026-11-04";

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
        createdAt: "2026-11-01T00:00:00.000Z",
        updatedAt: "2026-11-01T00:00:00.000Z",
        ...overrides,
    };
}

describe("prioritization engine", () => {
    it("ranks overdue commitments above commitments due later", () => {
        const commitments = [
            createCommitment({
                id: "later",
                title: "Later commitment",
                dueDate: "2026-11-10",
            }),
            createCommitment({
                id: "overdue",
                title: "Overdue commitment",
                dueDate: "2026-11-03",
            }),
        ];

        const result = rankActionableCommitments(commitments, today);

        expect(result[0].commitment.id).toBe("overdue");
        expect(result[0].reasons).toContain("overdue");
    });

    it("considers priority when ranking commitments", () => {
        const commitments = [
            createCommitment({
                id: "low",
                title: "Low priority",
                priority: "low",
            }),
            createCommitment({
                id: "critical",
                title: "Critical priority",
                priority: "critical",
            }),
        ];

        const result = rankActionableCommitments(commitments, today);

        expect(result[0].commitment.id).toBe("critical");
        expect(result[0].score).toBeGreaterThan(result[1].score);
    });

    it("excludes blocked commitments from actionable results", () => {
        const commitments = [
            createCommitment({
                id: "prerequisite",
                title: "Prerequisite",
            }),
            createCommitment({
                id: "blocked",
                title: "Blocked commitment",
                prerequisiteIds: ["prerequisite"],
            }),
        ];

        const result = rankActionableCommitments(commitments, today);

        expect(result.map((item) => item.commitment.id))
            .toEqual(["prerequisite"]);
    });

    it("excludes completed and cancelled commitments", () => {
        const commitments = [
            createCommitment({
                id: "completed",
                title: "Completed",
                lifecycle: "completed",
            }),
            createCommitment({
                id: "cancelled",
                title: "Cancelled",
                lifecycle: "cancelled",
            }),
            createCommitment({
                id: "open",
                title: "Open",
            }),
        ];

        const result = rankActionableCommitments(commitments, today);

        expect(result.map((item) => item.commitment.id))
            .toEqual(["open"]);
    });

    it("considers downstream impact in prioritization", () => {
        const commitments = [
            createCommitment({
                id: "unblocks",
                title: "Unblocks another commitment",
                dueDate: "2026-11-24",
            }),
            createCommitment({
                id: "independent",
                title: "Independent commitment",
                dueDate: "2026-11-24",
            }),
            createCommitment({
                id: "dependent",
                title: "Dependent commitment",
                prerequisiteIds: ["unblocks"],
            }),
        ];

        const result = rankActionableCommitments(commitments, today);

        expect(result[0].commitment.id).toBe("unblocks");
        expect(result[0].downstreamImpactCount).toBe(1);
        expect(result[0].reasons)
            .toContain("unblocks-other-commitments");
    });

    it("uses commitment ID as a deterministic final tie-breaker", () => {
        const commitments = [
            createCommitment({
                id: "z",
                title: "Z commitment",
            }),
            createCommitment({
                id: "a",
                title: "A commitment",
            }),
        ];

        const result = rankActionableCommitments(commitments, today);

        expect(result.map((item) => item.commitment.id))
            .toEqual(["a", "z"]);
    });

    it("caps downstream impact at 11 when calculating the score", () => {
        const commitments = [
            createCommitment({
                id: "root",
                title: "Root commitment",
            }),
            ...Array.from({ length: 15 }, (_, index) =>
                createCommitment({
                    id: `dependent-${index}`,
                    title: `Dependent ${index}`,
                    prerequisiteIds: ["root"],
                }),
            ),
        ];

        const result = rankActionableCommitments(commitments, today);

        const root = result.find(
            (item) => item.commitment.id === "root",
        );

        expect(root?.downstreamImpactCount).toBe(11);
        expect(root?.score).toBe(300);
    });

    it("does not count completed or cancelled downstream commitments", () => {
        const commitments = [
            createCommitment({
                id: "root",
                title: "Root",
            }),
            createCommitment({
                id: "completed",
                title: "Completed dependent",
                prerequisiteIds: ["root"],
                lifecycle: "completed",
            }),
            createCommitment({
                id: "cancelled",
                title: "Cancelled dependent",
                prerequisiteIds: ["root"],
                lifecycle: "cancelled",
            }),
        ];

        const result = rankActionableCommitments(commitments, today);

        const root = result.find(
            (item) => item.commitment.id === "root",
        );

        expect(root?.downstreamImpactCount).toBe(0);
        expect(root?.reasons).not.toContain(
            "unblocks-other-commitments",
        );
    });

    it("counts unique downstream commitments in a diamond dependency graph", () => {
        const commitments = [
            createCommitment({
                id: "a",
                title: "A",
            }),
            createCommitment({
                id: "b",
                title: "B",
                prerequisiteIds: ["a"],
            }),
            createCommitment({
                id: "c",
                title: "C",
                prerequisiteIds: ["a"],
            }),
            createCommitment({
                id: "d",
                title: "D",
                prerequisiteIds: ["b", "c"],
            }),
        ];

        const result = rankActionableCommitments(commitments, today);

        const root = result.find(
            (item) => item.commitment.id === "a",
        );

        expect(root?.downstreamImpactCount).toBe(3);
        expect(root?.score).toBe(230);
    });

    it("treats a commitment due exactly three days later as due soon", () => {
        const commitments = [
            createCommitment({
                id: "deadline",
                title: "Deadline",
                dueDate: "2026-11-07",
            }),
        ];

        const result = rankActionableCommitments(commitments, today);

        expect(result[0].score).toBe(500);
        expect(result[0].reasons).toContain("due-soon");
    });
});