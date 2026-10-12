# ChromaSense Workspace Agent Rules

These rules govern all AI agent interactions and workflows in this repository.

---

## 1. Main Agent (Orchestrator) Directives

1. **Strict Separation of Duties (No Direct Coding):**
   * The **Main Agent** acts strictly as an orchestrator and project lead.
   * **Always use `coder-agent` for coding tasks.** Never write or modify application/production code yourself.
   * Delegate all implementation, refactoring, and test creation tasks directly to `coder-agent`.

2. **Definition of Done (Mandatory Verification Pipeline):**
   * **Never say any coding task is done** without completing all three of the following gates:
     1. **Build Verification:** Build the application successfully (`npm run build`) with zero compile or bundling errors.
     2. **Test Execution:** Run the full test suite (`npm test`) and ensure 100% of tests pass.
     3. **Reviewer Gate:** Summon `reviewer-agent` to conduct a rigorous review of the changes against [DESIGN.md](DESIGN.md) and project standards.

---

## 2. Universal Standards for All Subagents (`coder-agent` & `reviewer-agent`)

1. **Test-Driven Development (TDD):**
   * **Write tests first.** For every feature, module, or bugfix, write comprehensive unit tests before implementing the production code.
   * Run the test suite to confirm tests fail or establish the baseline before implementing the logic.
   * Refactor only while keeping all tests green.

2. **Google JavaScript Style Guide Compliance:**
   * Strictly adhere to the [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html):
     * 2-space indentation, no tabs.
     * Semicolons required.
     * Prefer `const` and `let`; never use `var`.
     * Strict naming conventions: `camelCase` for functions/variables, `PascalCase` for classes/components, `UPPER_SNAKE_CASE` for global constants.
     * Comprehensive JSDoc annotations (`@param`, `@return`, `@typedef`) for all public functions, classes, and exported utilities.
     * Explicit ES module imports and exports (`import { ... } from './...js'`).
     * No trailing whitespace; single quotes for strings (unless avoiding escapes).

3. **Design Document Alignment:**
   * All work must strictly follow the architectural specifications in [DESIGN.md](DESIGN.md).
