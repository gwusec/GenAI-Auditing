# 00 · Start here — status, decisions & open questions

Read this first if you're picking the project back up. It records where we stopped, what's already decided (so you don't relitigate it), what's still open, and the sources behind the claims in the other docs.

## Current status (as of July 2026)

This is a **scoping and design stage** — documentation and interactive mockups, no implementation yet. What exists:

- The written design set in this folder (`01`–`05`, plus the architecture diagram).
- Three clickable HTML mockups in `mockups/` (investigator setup, auditor review, checkpoint/gating).
- A Lovable prompt (`lovable-prototype-prompt.md`) to one-shot a demo prototype for an advisor.

No code, no repo scaffolding for the tool itself yet. It lives inside the existing TRAILS-Website repo, which is the parent chatbot-audit platform (see `../docs/PRD.md`).

## The idea in three sentences

TRAILS-Agents extends the TRAILS chatbot-audit tool from judging a single chatbot *response* to judging the whole *flow* of an agentic system — its plan, tool calls, results, reasoning, and actions. A human reviews the trajectory step by step and judges it at the node, span, and whole-trajectory level, with an AI judge triaging which steps to look at. It's positioned as a rigorous, reproducible **human-evaluation instrument** (for research and for EU AI Act–style oversight), not an observability dashboard or a benchmark harness.

## Decisions already made (don't relitigate without reason)

- **Direction:** audit the agent (the subject is agentic), with a human in the loop judging the flow. Not "agents doing the auditing."
- **Reviewer persona:** expert reviewers are a first-class case, not only crowd-recruited auditors. Trajectories are long and technical.
- **Stimulus:** recorded/frozen trajectories, not live chat. This deliberately breaks TRAILS' "live interaction only" stance, and it's the feature that gives reproducibility (same frozen flow → N reviewers).
- **Ingestion contract:** OpenTelemetry GenAI traces (plus framework exports). This makes us runtime-agnostic in one move.
- **AI judge:** integrated as a *triage* layer that pre-flags steps and records judge-vs-human agreement — never issues the verdict.
- **Benchmarks:** kept separate; we interoperate (import failed runs as stimuli) rather than absorb.
- **Build order:** post-hoc replay path end-to-end first; everything live (gating, monitor) last.
- **Compliance posture:** we're the instrument that provides oversight capability + audit evidence; the deployer owns compliance. We are not a data controller.
- **Licensing:** reuse only permissive (MIT / Apache-2.0) components; avoid SurveyJS Creator and Langfuse Enterprise modules. Parent project is Apache-2.0.
- **Naming / location:** project is "TRAILS-Agents"; docs live in `agent-audit-docs/` inside the TRAILS-Website repo.

## Open questions (the real next-decisions)

- **Gate policy:** what exactly triggers a checkpoint pause (spend thresholds, any external side-effect, a policy DSL)? Undecided — only illustrated in the mockup.
- **Judge calibration:** how do we measure and report judge-vs-human agreement, and what's "good enough"? Method not specified.
- **OTel → event-log mapping:** the detailed field-level mapping from spans to our event types (`tool_call`, `tool_result`, etc.) is conceptual, not specified. This is the Phase 0 risk.
- **Reviewer visibility as an independent variable:** we note that showing/hiding reasoning changes "what people notice" — but haven't decided whether to study that or just make it a config toggle.
- **Hosting / IRB / data governance:** inherits TRAILS' self-host stance, but the governance-buyer audience may need more (retention, tamper-evidence guarantees). Unspecified.
- **Which framework to build the ingest adapter for first** (LangGraph is the likely default given adoption, but unconfirmed).
- **Accessibility of node/span selection** — flagged as the hard case in TRAILS §8.2, carried over, not solved.

## The obvious next step

If resuming with intent to build: start **Phase 0 (ingestion)** from `05-roadmap.md` — get one real OpenTelemetry GenAI trace (or a LangGraph export) round-tripping into the append-only event log. That single spike de-risks the whole downstream plan. If resuming to keep socializing the idea: run the Lovable prompt and/or the mockups past the advisor and collect reactions.

## Sources behind the claims

These ground the landscape, regulatory, and licensing statements in the other docs (verified July 2026). Present-day facts move fast — re-check before relying on them externally.

Landscape & method:
- LLM agent evaluation metrics 2026 — https://www.confident-ai.com/blog/llm-agent-evaluation-complete-guide
- ATBench: agent trajectory benchmark for safety evaluation — https://arxiv.org/pdf/2604.02022
- Log analysis is necessary for credible evaluation of AI agents — https://arxiv.org/pdf/2605.08545
- Agent-as-a-Judge — https://arxiv.org/pdf/2410.10934
- Human-on-the-Bridge: scalable evaluation for AI agents — https://arxiv.org/pdf/2606.16871
- METR, measuring autonomous AI capabilities — https://metr.org/measuring-autonomous-ai-capabilities/
- Inspect AI (UK AISI) overview — https://neurlcreators.substack.com/p/inspect-ai-evaluation-framework-review

Regulation:
- EU AI Act compliance 2026 (high-risk requirements) — https://salt.security/eu-ai-act-compliance
- EU AI Act compliance checklist 2026 — https://witness.ai/blog/eu-ai-act-compliance-checklist-2026/

Tools & observability:
- Langfuse human annotation — https://langfuse.com/docs/evaluation/evaluation-methods/annotation
- Langfuse open-source strategy / licensing — https://langfuse.com/docs/open-source
- MLflow 3 for GenAI — https://mlflow.org/docs/latest/genai/
- OpenTelemetry GenAI semantic conventions — https://uptrace.dev/blog/opentelemetry-ai-systems
- Multi-agent frameworks 2026 (LangGraph/CrewAI/OpenAI SDK) — https://gurusup.com/blog/best-multi-agent-frameworks-2026

Licenses (verified):
- Langfuse LICENSE — https://github.com/langfuse/langfuse/blob/main/LICENSE (MIT core; EE modules for SCIM/audit logs/retention)
- MLflow — Apache-2.0 — https://github.com/mlflow/mlflow
- Inspect AI — MIT — https://github.com/UKGovernmentBEIS/inspect_ai/blob/main/LICENSE
- LangGraph — MIT — https://github.com/langchain-ai/langgraph/blob/main/LICENSE
- OpenAI Agents SDK — MIT — https://github.com/openai/openai-agents-python/blob/main/LICENSE
- SurveyJS licensing (Form Library MIT; Creator commercial) — https://surveyjs.io/licensing
