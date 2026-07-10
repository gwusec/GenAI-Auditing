# 01 · Vision — what we're building

## The problem

Automated agent benchmarks tell you whether an agent completed a task. They are largely blind to *how* it got there. But the failures that matter most in deployed agents are trajectory failures, not answer failures: an unnecessary or unauthorized tool call, a destructive or irreversible action, a silently fabricated tool result, over-reach beyond what the user asked for, or a useless loop that burns money and time. A pass/fail score hides all of these. A person looking at the flow catches them.

Structured, research-grade *human* judgment of agent trajectories is currently under-tooled. The credible evaluation harnesses in the safety community (Inspect, METR's tooling) are built for running capability evals at scale, not for capturing what a human notices when they read a full execution trace. The developer observability tools (Langfuse, MLflow) capture traces and support ad-hoc annotation, but they are built to debug one deployment, not to run a controlled study across many reviewers. That gap — a rigorous instrument for human evaluation of agent flows — is what TRAILS-Agents fills.

The need is no longer only academic. Under the EU AI Act, agents taking consequential actions are the archetype of high-risk systems, which must provide human oversight (Article 14) and traceable audit trails of their decisions (Article 12), with high-risk obligations enforceable from August 2026. A recorded trajectory plus a documented human judgment on it is close to exactly the artifact those duties ask for. See [`04-compliance.md`](04-compliance.md).

## What TRAILS-Agents is

An instrument for **rigorous, reproducible human evaluation of agent trajectories.** An investigator configures a study; the system presents agent flows to human reviewers as structured, navigable trajectories; reviewers judge them at the step, span, and whole-trajectory level; and the collected judgments export as tidy, analyzable data with full provenance.

It inherits the design spine of TRAILS: the stimulus (the flow) is kept strictly separate from the judgments about it, the flow is an append-only event log from which the view is derived, and study configuration is the backbone that fully determines the reviewer experience.

## What it is not

It is not an agent runtime — it does not build or host agents, it consumes the traces they produce. It is not an observability or ops-monitoring dashboard — that is Langfuse/MLflow territory and competing there is a losing fight. It is not a benchmark harness — it interoperates with benchmarks rather than replacing them. And it is not a data controller for anyone's research or deployment; that responsibility stays with whoever runs the study, exactly as in the current TRAILS stance.

## Who it's for

Two audiences, sharing one instrument.

The first is **research and safety-science groups** — the existing TRAILS audience, extended to agent behavior. They want controlled stimuli, clean exports, and reproducibility so they can study what people notice about agent conduct and publish it.

The second is new: **governance and oversight teams** at organizations deploying agents, who need a defensible human-oversight process and an audit trail to meet internal risk policy or regulation.

A note on the reviewer persona: unlike the chatbot tool, where crowd-recruited, time-boxed, non-technical auditors are the default, agent-flow review often needs *expert* reviewers with the domain context to judge whether an action was safe and appropriate. Trajectories are long and technical. This is a real repositioning — the tool should assume expert reviewers as a first-class case, and a "human reviews a filtered subset" workflow rather than pure crowd scale (see the AI-judge triage layer in [`03-architecture.md`](03-architecture.md)).

## What changes from the chatbot audit tool

The chatbot tool judges a single text response. TRAILS-Agents judges a flow. Concretely:

The **unit of judgment** multiplies. In the chatbot tool it is a message or a character span. Here it is at least four things: a node (this tool call was wrong), an edge (the agent chose the wrong next step given what it knew), a span within any node (a phrase inside a reasoning trace or tool argument), and the whole trajectory (did it complete the goal, safely, efficiently).

The **harm surface** shifts. Bias/fairness/harm in text still matters for what the agent *says*, but the dominant new axis is judging *actions*: was a tool call appropriate, authorized, safe, and reversible.

The **stimulus becomes a recorded trajectory** rather than a live chat. This is a deliberate break from the chatbot tool's "live interaction only" stance, and it is a feature, not a regression: freezing a trajectory lets the identical flow be shown to many reviewers, which turns agent non-determinism from a problem into a controlled variable.

## The one decision that drives everything: where the human sits

"Human in the loop auditing the flow" resolves into three modes. The study config picks one; they are not mutually exclusive across studies but they imply very different UX and infrastructure.

**Post-hoc replay** is the backbone. The agent runs to completion, the full trajectory is recorded, and the human audits the recording afterward. It is the most scalable and the most comparable, and it is the closest to the chatbot tool's "end then audit" rhythm. This is the first mode we build. (See the auditor-review mockup.)

**Checkpoint / gating** is the most agent-native and the most oversight-relevant. The agent runs live but pauses before a risky action; the human approves, edits, or rejects it before it proceeds, and every decision is recorded. This is human-in-the-loop in the control sense, and it maps directly onto the EU AI Act's "intervene, interrupt, or stop" requirement. It is heavier on infrastructure and latency, and depends on a live-agent connection. (See the checkpoint/gating mockup.)

**Live monitor** is the middle ground: the agent runs autonomously, the human watches the flow stream in and can flag or interrupt. Deferred.

The prototype's working path is **trace import → post-hoc replay**. Checkpoint/gating is designed and mocked as a preview; live monitor is planned. See [`03-architecture.md`](03-architecture.md) for how these map onto the ingestion and data model.

## Near-term success criterion

Mirroring the discipline of the original PRD: a small number of external groups — research teams and/or oversight functions — able to stand up TRAILS-Agents, import their own agent traces, and run a real human trajectory-review study end to end, with clean exportable data. Breadth of features is explicitly secondary to that being solid.
