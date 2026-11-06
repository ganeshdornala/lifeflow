import { describe, expect, it } from "vitest";
import {
    createUnverifiedOutcome,
    recordOutcomeVerification,
    isOutcomeAchieved,
} from "./outcome-verification";

describe("outcome verification", () => {
    it("creates an unverified outcome by default", () => {
        expect(createUnverifiedOutcome()).toEqual({
            status: "unverified",
            method: null,
            verifiedAt: null,
            notes: "",
        });
    });

    it("records an achieved outcome", () => {
        const result = recordOutcomeVerification(
            "achieved",
            "direct-observation",
            "Appointment attended",
            "2026-11-05T10:00:00.000Z",
        );

        expect(result).toEqual({
            status: "achieved",
            method: "direct-observation",
            verifiedAt: "2026-11-05T10:00:00.000Z",
            notes: "Appointment attended",
        });
    });

    it("records an outcome that was not achieved", () => {
        const result = recordOutcomeVerification(
            "not-achieved",
            "external-confirmation",
            "Application was rejected",
            "2026-11-05T10:00:00.000Z",
        );

        expect(result.status).toBe("not-achieved");
    });

    it("trims verification notes", () => {
        const result = recordOutcomeVerification(
            "achieved",
            "document",
            "  Policy document received  ",
            "2026-11-05T10:00:00.000Z",
        );

        expect(result.notes).toBe("Policy document received");
    });

    it("rejects an invalid verification timestamp", () => {
        expect(() =>
            recordOutcomeVerification(
                "achieved",
                "document",
                "",
                "invalid-date",
            ),
        ).toThrow("Invalid verification timestamp");
    });

    it("identifies achieved outcomes", () => {
        const achieved = recordOutcomeVerification(
            "achieved",
            "direct-observation",
        );

        const unverified = createUnverifiedOutcome();

        expect(isOutcomeAchieved(achieved)).toBe(true);
        expect(isOutcomeAchieved(unverified)).toBe(false);
    });

    it("does not treat a failed outcome as achieved", () => {
        const failed = recordOutcomeVerification(
            "not-achieved",
            "external-confirmation",
        );

        expect(isOutcomeAchieved(failed)).toBe(false);
    });
});