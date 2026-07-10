# 03 · Architecture

This document records the architectural decisions we have already reasoned through. It is conceptual, not a schema or an API spec.

## The central idea: trace-as-stimulus

TRAILS-Agents does not run agents. It **ingests a recorded trajectory** and treats it as the stimulus a human reviews. The ingestion contract is the **OpenTelemetry GenAI trace** (or an equivalent framework trace / MCP tool-call log). Because LangGraph, CrewAI, the OpenAI Agents SDK, and AutoGen all emit OTel-compliant spans, ingesting that format makes us **runtime-agnostic in one move**: any of them can feed the tool without a bespoke integration each time.

This is also what unlocks the tool's signature capability. A trace is a complete, replayable record. We can **freeze** a trajectory and hand the identical frozen flow to N reviewers. Agent runs are non-deterministic — live tool state, timing, environment — which normally makes controlled human study impossible. Freezing converts that non-determinism from a bug into a controlled variable, and no tool actually re-executes when reviewer #37 opens the flow (safe and cheap).

## The event log generalizes — this is why TRAILS is a good base

The existing TRAILS conversation is an append-only event log; the UI view and the model context are both *derived* from it. That model extends to agent flows almost for free. Today's events (`new_user_message`, `new_bot_message`, `edit_message`, `restart_chat`, `end_chat`) gain trajectory event types:

`plan_step`, `agent_thought` / `reasoning`, `tool_call`, `tool_result`, `subagent_spawn`, `subagent_result`, `state_change`, `final_answer`.

An OTel span maps onto an event; a nested span (a tool call inside a sub-agent) maps onto a child event. The two invariants that make TRAILS good both survive: the view is derived from the log (so resume and re-render are unchanged), and the stimulus stays separate from the judgments about it.

## Unit of judgment: four levels

Where the chatbot tool has "react to a message" and "highlight a span," the flow needs four annotation targets, all referencing nodes in the event log:

- **Node** — flag/critique a single step (this tool call was unauthorized; this reasoning step hallucinated).
- **Edge / transition** — the agent chose the wrong next step given what it knew; the plan didn't follow from the goal.
- **Span** — the same character-offset critique as TRAILS, but now the span can live inside a tool argument, a tool result, or a reasoning trace, not only a final message.
- **Trajectory** — the summative questionnaire: goal completion, action safety, efficiency, error recovery.

Span-offset stability (TRAILS §6.4) generalizes: store the node id + a hash of the node's canonical text with every annotation, and assert on read that the node is unchanged; on mismatch, flag rather than silently render. This keeps annotations meaningful across replay and export.

## The AI judge: integrate it, but only as triage

The research consensus is clear and we adopt it directly: an LLM-as-judge *alone* is insufficient for agentic systems — a single judge model produces plausible scores without grasping domain policy, operational risk, required tool sequence, or the broader trajectory. Trajectory-aware "agent-as-a-judge" does much better but still needs human validation on the hard cases.

So the judge lives **inside** TRAILS-Agents as a first-pass triage layer: it pre-flags suspicious steps and routes them to humans, and — importantly — its agreement or disagreement with the human decision is itself recorded as calibration data. It never issues the verdict. This is what makes the "expert reviews a filtered subset" workflow tractable at the volume real agents generate, without surrendering the human signal that is the tool's whole reason to exist.

## Benchmarks: keep separate, interoperate

Benchmarks (Inspect, ATBench, capability suites) answer "how does model X score on fixed task set Y," run headless at scale, and are owned by the safety-eval community. Absorbing that would dilute us and put us head-to-head with entrenched harnesses. Instead we **interoperate**: import a benchmark run's trajectories as stimuli — "these 40 Inspect runs failed; send them to human reviewers to find out *why*." That makes TRAILS-Agents the human-judgment layer *on top of* the benchmark ecosystem, which is also where the credibility already sits.

## The three human-in-the-loop modes, architecturally

**Post-hoc replay (build first).** Pure ingestion: import trace → freeze → serve to reviewers → collect judgments. No live connection, no sandbox, no agent execution. This is why it's first — it is the lowest-infrastructure path and reuses the most of TRAILS.

**Checkpoint / gating (designed, previewed).** Requires a *live* connection to a running agent and a pause/resume protocol: the agent requests approval before a policy-flagged action (e.g. spend over a threshold, any external side-effect), the human approves / edits / rejects, and the decision plus rationale is written to the log and returned to the agent. This is heavier — latency, a live control channel, and a policy engine deciding what triggers a pause — and it is the mode that most directly satisfies the EU AI Act's "intervene, interrupt, or stop" requirement (see [`04-compliance.md`](04-compliance.md)).

**Live monitor (planned).** Autonomous run, human watches the stream and can flag or interrupt. Between the other two in weight.

## Study configuration is still the backbone

As in TRAILS, one config object fully determines the reviewer experience. For agent flows it adds: the trajectory **source** (OTel/framework import, benchmark import, or live-agent connection); the **control mode**; **what the reviewer sees** (reasoning/thoughts, raw tool I/O, sub-agent detail — each a research-meaningful toggle, because it changes what "what people notice" even means); the enabled **judgment methods**; and the **judge triage** on/off. Provenance is captured with every trajectory: control mode, tools available, tool/environment versions, and model/agent config id + version, so analysts can stratify.

## Conceptual data model (delta from TRAILS)

Reusing the TRAILS entities (Study, StudyConfig, Membership, AuditorSession, ConsentRecord, Export) with these changes:

- **Trajectory** replaces/extends *Conversation* — an append-only event log of agent steps, plus provenance (source, tools, versions, control mode).
- **Event** gains the agent event types above; each may reference a parent event (sub-agent nesting) and carries a canonical-text hash.
- **StepReaction** generalizes *TurnReaction* — references any Event, not only a bot message.
- **NodeAnnotation / SpanAnnotation** — references an Event (and optional offset span within it); carries node hash + quoted text for stability.
- **TrajectoryAudit** generalizes *AuditResponse* — the summative questionnaire for the whole flow.
- **JudgeFlag (new)** — an AI-judge pre-flag on an Event, with the model/prompt that produced it; later joined against the human decision for calibration.
- **GateDecision (new, checkpoint mode)** — the approve/edit/reject action on a pending Event, with rationale, actor, and timestamp: the oversight artifact.

The guiding separation from TRAILS holds throughout: the trajectory (what the reviewer saw) stays cleanly separable from the judgments (what the reviewer decided), which is exactly the separation analysis and audit both need.
