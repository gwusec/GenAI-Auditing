# 05 · Roadmap & build order

This sketches the order to build in, chosen so each phase ships something usable and the riskiest/heaviest work (a live agent connection) comes last. The guiding principle is the same as the original TRAILS PRD: solid and narrow beats broad and shaky. See [`architecture-diagram.svg`](architecture-diagram.svg) for the pipeline these phases build out.

## Sequencing principle

Build the **post-hoc replay** path end to end before anything live. It reuses the most of TRAILS, needs no sandbox or agent runtime, and delivers the signature capability (frozen trajectory → many reviewers) on its own. Everything live — checkpoint/gating, live monitor — is deferred behind it because it adds a control channel, latency, and a policy engine that aren't needed to prove the idea.

## Phase 0 — Ingestion (the foundation)

Turn an OpenTelemetry GenAI trace (and one framework export, e.g. LangGraph) into the internal append-only event log. Map spans to event types (`plan_step`, `tool_call`, `tool_result`, `agent_thought`, `final_answer`, sub-agent nesting). Store the canonical text + hash per node for offset stability. **Done when:** a real trace imports and round-trips to a faithful event log. This phase is the whole bet — if ingestion is clean, everything downstream is TRAILS-shaped work.

## Phase 1 — Reviewer replay + study config

The auditor-review screen over a frozen trajectory (the existing mockup), plus the minimum study config: source = trace import, mode = post-hoc replay, visibility toggles, enabled methods. Freeze a trajectory and serve the identical flow to multiple reviewers. **Done when:** an investigator imports traces, opens a study with a join code, and reviewers can walk the flow.

## Phase 2 — Judgment capture + export

The four judgment levels (step reactions, node/span critique, trajectory questionnaire) writing to the separated judgment records, with node-hash assertion on read. Tidy/long CSV + JSON export with provenance columns, plus the self-contained oversight artifact (trajectory + decisions). **Done when:** a completed study exports clean, analyzable, provenance-tagged data.

*At the end of Phase 2 there is a genuinely useful product: reproducible human trajectory review with exportable data. Everything after is leverage.*

## Phase 3 — AI judge triage

An LLM/agent-as-judge pass that pre-flags suspicious steps and routes reviewers to them, recording judge-vs-human agreement as calibration. Reuse Langfuse's MIT judge machinery or a direct provider call. **Done when:** the reviewer sees pre-flags, and the export includes a judge-vs-human calibration join. This is what makes the "expert reviews a filtered subset" workflow scale.

## Phase 4 — Benchmark interop

Import a benchmark run's trajectories (Inspect / ATBench) as stimuli — "these failed runs, send them to humans to find out why." Mostly an ingestion adapter reusing Phase 0. **Done when:** a benchmark batch's failures land as a review study.

## Phase 5 — Checkpoint / gating (first live mode)

The heavy one. A live connection to a running agent, a pause/resume protocol, and a policy engine deciding what triggers a pause (spend thresholds, external side-effects). The human approves / edits / rejects; the `GateDecision` is logged and returned to the agent. This is the mode that directly satisfies the EU AI Act's "intervene, interrupt, or stop." **Done when:** a live agent pauses on a policy-flagged action and resumes on the human's decision (the checkpoint mockup, made real).

## Phase 6 — Live monitor + polish

Autonomous run with a live watch-and-interrupt view; near-real-time observability; UX and accessibility passes (the span/node selection is the hard accessibility case, as in TRAILS §8.2).

## At a glance

| Phase | Delivers | Live agent needed? |
|-------|----------|--------------------|
| 0 | Trace → event log | No |
| 1 | Reviewer replay + study config | No |
| 2 | Judgment capture + export | No |
| 3 | AI judge triage | No |
| 4 | Benchmark import | No |
| 5 | Checkpoint / gating | Yes |
| 6 | Live monitor + polish | Yes |

---

## Contributing (starter notes)

This will firm up once code exists; for now the intent:

**License.** TRAILS-Agents follows the parent project's **Apache-2.0**. Contributions are under the same license. Keep dependency notice files; do not vendor code under incompatible or commercial-only terms (see [`02-borrow-vs-build.md`](02-borrow-vs-build.md) — notably, never pull in SurveyJS *Creator* or Langfuse *Enterprise* modules).

**Design invariants to preserve.** The stimulus (trajectory) stays separate from judgments about it. The view derives from the append-only event log — never mutate history. Annotations carry a node hash and assert on read. Provenance travels with every trajectory. These are the properties that make the data trustworthy; a change that breaks one needs a very good reason.

**Working style.** Each phase should land behind its config flag so an incomplete mode never reaches a reviewer (mirroring how the mockups mark unbuilt modes as "planned"). Prefer interoperating with an existing tool over rebuilding it.
