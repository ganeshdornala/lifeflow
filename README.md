
# LifeFlow

**A personal responsibility and commitment execution system.**

LifeFlow helps people manage important real-world responsibilities from initial planning through actual outcome verification.

Unlike a conventional to-do list, LifeFlow distinguishes between completing an action and achieving the intended outcome.

For example, paying an insurance premium does not necessarily mean the renewed policy has been issued and is active.

## Core capabilities

- **Commitment management:** Represent important responsibilities with deadlines, priorities and lifecycle states.
- **Dependency management:** Identify prerequisites and prevent blocked work from being treated as ready.
- **Workflow execution:** Break commitments into ordered, dependency-aware steps.
- **Impact analysis:** Understand which downstream commitments depend on unfinished work.
- **Prioritization:** Rank work using urgency, priority and downstream impact.
- **Outcome verification:** Require an explicit achieved outcome before marking a commitment complete.

## Technology stack

- Next.js (App Router)
- React
- TypeScript
- Vitest

## Project status

The current implementation includes:

- Initial LifeFlow interface.
- Pure TypeScript domain models and business logic.
- Commitment dependency engine.
- Workflow execution engine.
- Prioritization engine.
- Outcome verification engine.
- Automated domain tests.

**Current test coverage:** 106 passing tests across 5 test files.

Backend persistence, authentication, document evidence storage and production deployment are planned future milestones. They are not represented as completed features.

## Getting started

### Prerequisites

- Node.js
- npm

### Installation

```bash
git clone <your-repository-url>
cd lifeflow
npm install
```

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run tests

```bash
npm test
```

### Type-check

```bash
npx tsc --noEmit
```

## Engineering principles

- Model real-world constraints explicitly.
- Keep business logic independent of UI and infrastructure.
- Prefer deterministic, explainable decision-making.
- Validate dependencies and state transitions.
- Avoid unnecessary architectural complexity.
- Prioritize correctness, reliability and maintainability.

## Roadmap

1. Complete and harden the domain layer.
2. Introduce application services and persistence.
3. Implement authentication and authorization.
4. Build reliable workflow and commitment operations.
5. Add secure document evidence management.
6. Introduce reminders and risk detection.
7. Test, deploy and improve using real-world feedback.

---

LifeFlow is being developed incrementally, with correctness and practical usefulness taking priority over feature count.
