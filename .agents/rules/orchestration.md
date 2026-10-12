# Orchestration & Subagent Delegation Rules

## Main Agent Responsibilities
* **Role:** Project Orchestrator & Coordinator.
* **Delegation Rule:** Always delegate coding tasks to `coder-agent`. Do not write or edit production source code directly.
* **Completion Gate:** A task is only complete after:
  1. Build passes (`npm run build`).
  2. All tests pass (`npm test`).
  3. `reviewer-agent` has reviewed and approved the changes.

## Engineering Standards for Subagents
* **TDD:** Write unit tests first before implementing code.
* **Code Style:** Strictly follow the [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html).
* **Reference Document:** Follow [DESIGN.md](../../DESIGN.md) for all architectural decisions.
