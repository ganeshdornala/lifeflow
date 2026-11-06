import type { Commitment } from "./commitment";
import { assessAllCommitments} from "./dependency-engine";
import { getDaysBetweenDateOnly } from "./date";

export type ActionReason = 
    | "critical-priority"
    | "high-priority"
    | "medium-priority"
    | "low-priority"
    | "overdue"
    | "due-today"
    | "due-soon"
    | "due-this-week"
    | "due-this-month"
    | "unblocks-other-commitments";

export type RankedCommitment = {
    commitment: Commitment;
    score: number;
    reasons: ActionReason[];
    downstreamImpactCount: number;
};

const PRIORITY_SCORES = {
    critical: 400,
    high: 300,
    medium: 200,
    low: 100,
} as const;

const MAX_DOWNSTREAM_SCORE = 10;

function getPriorityReason(
    priority: Commitment["priority"],
): ActionReason {
    switch(priority) {
        case "critical":
            return "critical-priority";
        case "high":
            return "high-priority";
        case "medium":
            return "medium-priority";
        case "low":
            return "low-priority";
    }
}

/**
 * Builds a reverse adjacency list once.
 *
 * Key: prerequisite ID
 * Value: commitments that depend on that prerequisite.
 *
 * Complexity: O(V + E).
 */
function buildReverseDependencyIndex(
    commitments: readonly Commitment[],
): Map<string, string[]> {
    const dependents = new Map<string, string[]>();
    for(const commitment of commitments) {
        for(const prerequisiteId of commitment.prerequisiteIds) {
            const existing = dependents.get(prerequisiteId) ?? [];
            existing.push(commitment.id);
            dependents.set(prerequisiteId, existing);
        }
    }
    return dependents;
}

/**
 * Counts active downstream commitments, stopping as soon as
 * the score cap is reached.
 *
 * Completed and cancelled commitments are not traversed.
 *
 * Complexity: O(V + E) worst case, but often less due to the cap.
 */
function countActiveDownstream(
    commitmentId: string,
    byId: ReadonlyMap<string, Commitment>,
    dependents: ReadonlyMap<string, string[]>,
): number {
    const visited = new Set<string>([commitmentId]);
    const queue: string[] = [commitmentId];
    let count = 0;
    for(let head=0;head<queue.length;head++) {
        const currentId = queue[head];
        for(const dependentId of dependents.get(currentId) ?? []) {
            if(visited.has(dependentId)) {
                continue;
            }
            visited.add(dependentId);
            const dependent = byId.get(dependentId);
            if(!dependent || dependent.lifecycle !== "open") {
                continue;
            }
            count++;
            if(count > MAX_DOWNSTREAM_SCORE) {
                return count;
            }
            queue.push(dependentId);
        }
    }
    return count;
}

export function rankActionableCommitments(
    commitments: readonly Commitment[],
    today: string,
): RankedCommitment[] {
    const assessments = assessAllCommitments(commitments, today);
    const assessmentById = new Map(
        assessments.map((assessment) => [
            assessment.commitmentId,
            assessment,
        ]),
    );
    // Build these structures once instead of rebuilding them
    // for every actionable commitment.
    const byId = new Map(
        commitments.map((commitment) => [commitment.id, commitment]),
    );
    const dependents = buildReverseDependencyIndex(commitments);
    const ranked: RankedCommitment[] = [];
    for(const commitment of commitments) {
        const assessment = assessmentById.get(commitment.id)!;
         // Only open and currently actionable commitments qualify.
         if(
            commitment.lifecycle !== "open" ||
            assessment.readiness !== "ready"
         ) {
            continue;
         }
         let score = PRIORITY_SCORES[commitment.priority];
         const reasons: ActionReason[] = [
            getPriorityReason(commitment.priority),
         ];
         if(commitment.dueDate !== null){
            const daysUntilDue = getDaysBetweenDateOnly(
                commitment.dueDate, today
            );
            if(daysUntilDue<0) {
                score += 500;
                reasons.push("overdue");
            }else if(daysUntilDue === 0) {
                score += 400;
                reasons.push("due-today");
            } else if(daysUntilDue <= 3) {
                score += 300;
                reasons.push("due-soon");
            } else if(daysUntilDue <= 7) {
                score += 200;
                reasons.push("due-this-week");
            } else if(daysUntilDue <= 30) {
                score += 100;
                reasons.push("due-this-month");
            }
         }
         const downstreamImpactCount = countActiveDownstream(
            commitment.id,
            byId,
            dependents,
         );
         score += Math.min(
            downstreamImpactCount,
            MAX_DOWNSTREAM_SCORE,
         )*10;
        if(downstreamImpactCount > 0) {
            reasons.push("unblocks-other-commitments");
        }
        ranked.push({
            commitment,
            score,
            reasons,
            downstreamImpactCount,
        });
    }
    ranked.sort((a,b) => {
        if(a.score !== b.score) {
            return b.score - a.score;
        }
        const aDueDate = a.commitment.dueDate ?? "9999-12-31";
        const bDueDate = b.commitment.dueDate ?? "9999-12-31";
        if(aDueDate !== bDueDate) {
            return aDueDate.localeCompare(bDueDate);
        }
        const creationComparison =
            a.commitment.createdAt.localeCompare(
                b.commitment.createdAt,
            );
        if(creationComparison !== 0) {
            return creationComparison;
        }
        return a.commitment.id.localeCompare(b.commitment.id);
    });
    return ranked;
}