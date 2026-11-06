export type WorkflowStepStatus =
    | "pending"
    | "completed"
    | "skipped";

export type WorkflowStep = {
    id: string;
    commitmentId: string;
    title: string;
    description: string;
    status: WorkflowStepStatus;
    prerequisiteIds: string[];
    dueDate: string | null;
    createdAt: string;
    updatedAt: string;
};

export type WorkflowStepReadiness =
    | "ready"
    | "blocked"
    | "completed"
    | "skipped";

export type WorkflowStepAssessment = {
    stepId: string;
    readiness: WorkflowStepReadiness;
    blockerIds: string[];
};