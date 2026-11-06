import type { OutcomeVerification } from "./outcome-verification";

export type CommitmentLifecycle =
    | "open"
    | "completed"
    | "cancelled";

export type CommitmentPriority =
    | "low"
    | "medium"
    | "high"
    | "critical";

export type Commitment = {
    id: string;
    title: string;
    description: string;
    category: string;
    dueDate: string | null;
    priority: CommitmentPriority;
    lifecycle: CommitmentLifecycle;
    prerequisiteIds: string[];
    createdAt: string;
    updatedAt: string;
    outcomeVerification: OutcomeVerification;
};

export type CommitmentReadiness = 
    | "ready"
    | "blocked"
    | "completed"
    | "cancelled";

export type CommitmentAssessment = {
    commitmentId: string;
    readiness: CommitmentReadiness;
    blockerIds: string[];
    isOverdue: boolean;
};