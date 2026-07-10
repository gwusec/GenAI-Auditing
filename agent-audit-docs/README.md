# TRAILS-Agents

**Human-in-the-loop auditing for agentic AI systems.**

TRAILS-Agents extends the [TRAILS chatbot audit platform](../docs/PRD.md) from judging single chatbot *responses* to judging the whole *flow* of an agentic system — its plan, tool calls, tool results, reasoning steps, and final actions. The core question moves from "is this response biased or harmful?" to "did this agent take the right, safe, authorized path to get here?"

This folder holds the initial design documentation. It is a scoping and positioning set, not an implementation — the goal is to write down what we are building, what we can reuse (and whether we are legally allowed to), and the architectural decisions we have already reasoned through, before any code is written.

## Documents

| Doc | What it covers |
|-----|----------------|
| [`01-vision.md`](01-vision.md) | The problem, who it's for, what changes from the chatbot tool, and the three human-in-the-loop modes. |
| [`02-borrow-vs-build.md`](02-borrow-vs-build.md) | What we reuse vs build from scratch, with a verified open-source license table and the reuse strategy. |
| [`03-architecture.md`](03-architecture.md) | The trace-as-stimulus design, the event-log extension, the AI-judge and benchmark boundaries, and the data model. |
| [`04-compliance.md`](04-compliance.md) | Where this fits the EU AI Act's human-oversight and audit-trail duties, and our data-controller stance. |
| [`05-roadmap.md`](05-roadmap.md) | Phased build order (ingestion → replay → export → judge → gating) and contribution notes. |
| [`architecture-diagram.svg`](architecture-diagram.svg) | One-page pipeline diagram: trace source → freeze → human review → export. |
| [`lovable-prototype-prompt.md`](lovable-prototype-prompt.md) | Copy-paste prompt to one-shot a demo prototype in Lovable (to show an advisor). |

## Interactive mockups

Open these in any browser (self-contained, no internet needed). They browse as a set via the tab row at the top of each page.

- [`mockups/study-setup-mockup.html`](mockups/study-setup-mockup.html) — investigator configures a study (source, control mode, what the reviewer sees, judgment methods).
- [`mockups/agent-trajectory-audit-mockup.html`](mockups/agent-trajectory-audit-mockup.html) — the reviewer audits a frozen trajectory step by step (post-hoc replay).
- [`mockups/checkpoint-gating-mockup.html`](mockups/checkpoint-gating-mockup.html) — the interventional mode: the agent pauses before a risky action and the human approves, edits, or rejects it.

## One-line summary

Observability tools tell a developer whether their agent is working; TRAILS-Agents lets a researcher or oversight body run a rigorous, reproducible human study of what an agent actually *does*.

---

*Status: draft v0.1 · scoping. Not a running system. Licensing notes are engineering research, not legal advice — see [`02-borrow-vs-build.md`](02-borrow-vs-build.md).*
