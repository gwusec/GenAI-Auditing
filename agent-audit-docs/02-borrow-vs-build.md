# 02 · Borrow vs build — and can we legally use it?

Most of the plumbing for agent-flow auditing already exists as open source. The strategic mistake would be to rebuild it. The value of TRAILS-Agents is not in assembling commodity parts — it is in the one part nobody else has (the research-instrument layer). So the rule is: **assemble the commodity layers, build the differentiated one.**

## Two kinds of "borrow" — this is what determines license risk

It matters a great deal *how* we reuse something:

**Interoperate / integrate at runtime.** We depend on a library, or we ingest a data format it produces, and call it as-is. We are not copying its source into our codebase. This is by far the lower-risk path: for permissive licenses (MIT, Apache-2.0) there is essentially nothing to worry about beyond keeping the dependency's own license notice, and for a data *format* (like an OpenTelemetry trace) there is no licensing question at all — a file format is not copyrightable in the way source code is.

**Fork / vendor source code.** We copy code out of a project into ours. Now the project's license travels with that code: we must comply with its terms (attribution, notice files, and for copyleft licenses, source-sharing). For the projects below this is only relevant if we lift code rather than depend on it.

Almost everything we want to reuse is the first kind. That is the single most important licensing fact in this document.

## License compatibility with TRAILS

TRAILS itself is **Apache-2.0** (per the PRD). Apache-2.0 projects can freely incorporate and depend on **MIT** and **Apache-2.0** components — both are permissive and compatible. None of the reuse below introduces a copyleft (GPL-style) obligation. The only items requiring care are the *commercial* tiers of otherwise-open products, called out explicitly.

## The table

Verified against each project's stated licensing (July 2026). "Reuse mode" is how we intend to use it.

| Component | Role for us | License | Reuse mode | Allowed for our use? |
|-----------|-------------|---------|------------|----------------------|
| **OpenTelemetry GenAI semantic conventions + SDKs** | The trace *format* we ingest as the stimulus | Apache-2.0 | Interoperate (consume the format) | Yes — no obligations; it's a standard. |
| **MLflow** | Optional trace source / exporter to ingest from | Apache-2.0 | Interoperate | Yes — fully permissive. |
| **Langfuse** | Reference for trace/graph UI, annotation queues, LLM-as-judge; possible ingest source | MIT (core) | Interoperate; learn from | Yes — see nuance below. |
| **Inspect AI** (UK AISI) | Benchmark-run interop (import failed runs as stimuli) | MIT | Interoperate | Yes. |
| **LangGraph** | Agent runtime that produces traces we ingest | MIT (library) | Interoperate | Yes — library is MIT; see nuance. |
| **OpenAI Agents SDK** | Agent runtime that produces traces | MIT | Interoperate | Yes. |
| **CrewAI** | Agent runtime that produces traces | MIT (verify at integration) | Interoperate | Yes (confirm current LICENSE when we wire it up). |
| **SurveyJS Form Library** | Questionnaire rendering (already used by TRAILS) | MIT | Depend on | Yes — keep. |
| **SurveyJS Creator** | Visual form *builder* | **Commercial (per-developer)** | Avoid | Only with a paid license — we deliberately do not use it. |

## The two nuances that actually matter

**Langfuse.** Langfuse is open-core under MIT. Crucially, the pieces we care about — tracing, the API, the data model, exports, *and* (as of June 2025) annotation queues and managed LLM-as-judge evaluations — are all in the MIT core and free to self-host. The commercial Enterprise license is required only for enterprise-security/platform features: SCIM, extended audit logs, and data-retention policies (regular SSO stays MIT). Those are exactly the features we would *not* need to copy. So Langfuse is usable both as a reference for our UI and, if we want, as a trace ingestion source, without touching the commercial tier.

**SurveyJS.** The split we already rely on in TRAILS holds and should be preserved: the **Form Library** that renders questionnaires from JSON is MIT and free for commercial use; the **Survey Creator** visual builder is a paid per-developer commercial product. TRAILS avoids the Creator by editing the SurveyJS JSON through an in-house authoring UI plus a raw-JSON escape hatch. TRAILS-Agents keeps that same posture — reuse the MIT renderer, never adopt the commercial Creator. (Note: per-developer Creator licenses are only needed for developers who integrate its API, not for end users, if we ever reconsider.)

A smaller nuance: **LangGraph** the library is MIT, but LangChain's *LangGraph Platform* (hosted deployment) and *LangSmith* are commercial products. This is irrelevant to us because we ingest the traces LangGraph produces; we are not deploying agents on their platform.

## What we borrow

Trace capture and the OpenTelemetry GenAI format for ingestion (the format is the contract that makes us runtime-agnostic — LangGraph, CrewAI, OpenAI Agents SDK, AutoGen all emit it). The MIT SurveyJS Form Library for questionnaire rendering, carried straight over from TRAILS. Langfuse and MLflow as *references* for trace/graph visualization and annotation UX, and optionally as ingestion sources. Inspect as the interop point for pulling benchmark runs in as stimuli. An LLM/agent-as-judge as an internal triage layer (built on any provider, or reusing Langfuse's MIT judge machinery).

## What we build (the differentiated core)

The study-design and controlled-stimulus machinery: freezing a trajectory and serving the identical flow to N reviewers, with provenance versioning. The multi-rater, tidy-export judgment model that makes the data analyzable in R/Python rather than a debugging scratchpad. Step/node/span-level human critique with offset stability that survives replay and export. And the oversight/compliance surface — the recorded-trajectory-plus-human-decision artifact. None of the borrowed tools do these; they are the reason TRAILS-Agents exists.

## Standard caveat

This is engineering license research, not legal advice, and it is a snapshot as of July 2026. Licenses and commercial terms change. Before shipping, confirm each dependency's current `LICENSE` file at the version we pin, keep the required notice/attribution files, and if anything is being deployed commercially or at an organization with its own policy, have counsel review the dependency manifest.
