import { describe, expect, it } from "vitest";
import {
    getDaysBetweenDateOnly,
    isValidDateOnly,
} from "./date";

describe("isValidDateOnly", () => {
    it("accepts a valid date", () => {
        expect(isValidDateOnly("2026-11-05")).toBe(true);
    });

    it("rejects an invalid format", () => {
        expect(isValidDateOnly("05-11-2026")).toBe(false);
    });

    it("rejects impossible calendar dates", () => {
        expect(isValidDateOnly("2026-02-30")).toBe(false);
    });

    it("accepts February 29 in a leap year", () => {
        expect(isValidDateOnly("2024-02-29")).toBe(true);
    });

    it("rejects February 29 in a non-leap year", () => {
        expect(isValidDateOnly("2026-02-29")).toBe(false);
    });
});

describe("getDaysBetweenDateOnly", () => {
    it("returns zero for the same date", () => {
        expect(
            getDaysBetweenDateOnly("2026-11-05", "2026-11-05"),
        ).toBe(0);
    });

    it("calculates future dates correctly", () => {
        expect(
            getDaysBetweenDateOnly("2026-11-08", "2026-11-05"),
        ).toBe(3);
    });

    it("calculates past dates correctly", () => {
        expect(
            getDaysBetweenDateOnly("2026-11-04", "2026-11-05"),
        ).toBe(-1);
    });

    it("rejects invalid dates", () => {
        expect(() =>
            getDaysBetweenDateOnly("2026-02-30", "2026-11-05"),
        ).toThrow();
    });

    it("rejects invalid today values", () => {
        expect(() =>
            getDaysBetweenDateOnly("2026-11-05", "invalid"),
        ).toThrow();
    });
});