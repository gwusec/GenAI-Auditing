# TRAILS Chatbot Audit Tool — Product Requirements & Specification
**Status:** Draft v0.2 (internal scoping, pre–open-source release) — §9 scoping decisions D1–D9 resolved
**Date:** 2026-06-29
**License of the software being specified:** Apache-2.0
> Purpose of this document: turn the current MVP into a clearly scoped, buildable product. It states the problem, the users, the functional and non-functional requirements (tagged **MVP / V1 / Later** with acceptance criteria), the conceptual data model, and the open questions worth resolving before they cost rework. It is written to be built against and to live in the repository alongside the code.
---
## 1. Overview & problem statement
The TRAILS Chatbot Audit Tool is a web application for **human evaluation of AI chatbot responses** — specifically auditing those responses for fairness, bias, and harm. It comes out of trustworthy-AI / AI-safety research and is being prepared for open-source release.
Automated benchmarks tell you how a model scores against fixed tests. They do not tell you what *people* notice when they actually use a system — which responses strike a real person as biased, unfair, or harmful, and why. This tool is the instrument for collecting that second kind of evidence at scale: recruit people, let them interact with a chatbot, have them judge its responses through structured tasks, and collect that data in an analyzable form. It is meant to **complement** benchmarking, not replace it.
The intended deployment is by **other research groups who self-host it** to run their own studies. The near-term bar for success (see §2) is deliberately modest, and the requirements are scoped accordingly: clean enough that a few motivated groups can stand it up and run real studies, not generalized for a mass market.
### 1.1 Current state (honest baseline)
There is a working but very early MVP that functions end-to-end but is rough, and whose structure is not yet settled:
- **Frontend:** React (Create React App) + Material-UI. An event-sourced conversation model. A questionnaire builder and an audit/highlight UI exist.
- **Persistence:** browser-local storage (IndexedDB) by default; an optional self-hosted **Supabase** (Postgres + Auth + Row-Level Security + Storage) for real multi-user data.
- **Model access:** a small **relay** server (Node/Express) forwards chat to the chosen provider (Ollama for local models, or OpenAI / Anthropic) so API keys stay server-side.
- **Accounts/roles/studies ("Feature 0"), first pass:** investigators can sign up, create a study, author a questionnaire, and generate an access code; auditors join anonymously with a code; there is a no-signup demo. Per-study roles and data isolation via RLS are in place.
This document treats that baseline as the starting point and specifies where it goes next, including two architecture corrections adopted during scoping (§7.1).
---
## 2. Goals & non-goals
### 2.1 Goals
- Provide a self-hostable instrument that lets a research group **configure a study, recruit auditors, collect human judgments about chatbot responses, and export analyzable data.**
- Make **study configuration the backbone**: one place where an investigator defines models, evaluation methods, conversation control, limits, consent, and conversation count.
- Support the core evaluation methods well enough to run a real fairness/bias/harm study (§6).
- Ship clean self-hosting (turnkey Docker) and a try-it-out hosted demo.
### 2.2 Success criterion (~6 months after first release)
**2–3 external research groups run 1–2 studies each on the tool.** This single bar disciplines scope: it argues for solid self-hosting and documentation over breadth of features.
### 2.3 Non-goals (this version)
- **Not** a general-purpose survey platform. The questionnaire capability is a *component* of an audit instrument, not a standalone survey product.
- **Not** a data controller for anyone else's research. IRB and data governance belong to whoever runs the study (§8.1).
- **Not** an integrated crowd-recruitment platform. No built-in Prolific completion loop in this version (§5, AUD-10; revisited Later).
- **No** static/pre-generated stimuli yet — this version is **live interaction only**.
- **No** image generation or image annotation yet.
- **No** multi-language UI yet.
- Open-core / commercial productization is explicitly out of scope for now.
---
## 3. Personas & roles
Roles are **per study, not global**. A single person can be an investigator on one study and an auditor on another. Nothing about the account model assumes a global role.
**Investigator (researcher).** Designs and configures a study, recruits/assigns auditors (typically from a panel such as Prolific), watches results come in, and exports data for analysis in R/Python. Owns the study's IRB and consent. Cares most about: faithful capture of what auditors did, clean exports, and being able to set up a study without fighting the tool.
**Auditor (participant).** Recruited, usually **joins anonymously** via a link or access code with no account required (account optional). May not be technical. Time-boxed. Interacts with the chatbot, then judges it through the configured tasks, possibly across several conversations, then finishes. Cares most about: a clear, fast, unconfusing task that works on the first try and doesn't lose their progress.
---
## 4. User stories
Tagged by priority. "Audit" = the structured judgment an auditor makes about a conversation.
### 4.1 Investigator
- As an investigator, I want to create a study and configure everything about it in one place, so that a study is fully defined before anyone joins. **(MVP)**
- As an investigator, I want to choose how controlled the conversation is — seed prompt then free chat, or a fixed first chatbot turn then free chat — so that I can trade off realism against comparability. **(MVP)** (Fully-scripted turns are Later, §9 D2.)
- As an investigator, I want to select the model and set its system prompt and decoding parameters, so that auditors evaluate exactly the system I intend. **(MVP)**
- As an investigator, I want to set per-conversation and overall time/turn limits, so that sessions stay bounded and comparable. **(MVP)**
- As an investigator, I want to author the audit questionnaire (question types, pages, instructions, required fields) or start from a bundled fairness/bias template, so that I can capture the judgments I care about without building a survey tool. **(MVP)**
- As an investigator, I want to turn turn-level in-chat reactions and the post-conversation audit on or off independently, so that I can match the method to my research question. **(MVP)**
- As an investigator, I want to optionally attach my own consent text that auditors must agree to before starting, so that the tool fits my IRB rather than imposing its own. **(MVP)**
- As an investigator, I want to generate an access code / join link, so that I can recruit auditors. **(MVP)**
- As an investigator, I want to see who has completed sessions, drill into any one conversation, and see basic distributions (e.g., how many auditors flagged a given thing), so that I can sanity-check data as it arrives. **(MVP)**
- As an investigator, I want to export all study data as CSV and JSON in a tidy/long shape, so that I can analyze it in R or Python. **(MVP)**
- As an investigator, I want to compare two models side by side and have auditors pick the better response blind, so that I can collect pairwise preferences. **(V1)**
- As an investigator, I want to watch sessions in near-real-time, so that I can monitor a live data-collection batch. **(Later)**
### 4.2 Auditor
- As an auditor, I want to join a study from a link or code without making an account, so that I can start quickly. **(MVP)**
- As an auditor, I want to optionally create an account, so that I can be recognized across sessions if a study needs it. **(MVP)**
- As an auditor, I want to read and agree to consent (when present) before anything begins, so that I know what I'm participating in. **(MVP)**
- As an auditor, I want to chat with the chatbot within clear time/turn limits, so that I understand the bounds of the task. **(MVP)**
- As an auditor, I want to react to individual chatbot messages as I go (thumbs, star, flag, comment) when enabled, so that I can mark things in the moment. **(MVP)**
- As an auditor, I want to end the conversation and then complete the audit — rate it, highlight problematic spans, explain in my own words — so that my judgment is captured. **(MVP)**
- As an auditor, I want to do this across multiple conversations and then finish, so that I complete the study. **(MVP)**
- As an auditor, I want my progress to survive an accidental refresh or disconnect, so that I don't lose work. **(MVP)**
- As an auditor, I want to see two responses and pick the better one without knowing which model is which, so that my preference is unbiased. **(V1)**
---
## 5. Functional requirements
Each requirement has a stable ID (for issues/PRs), a priority, and an acceptance criterion. IDs are grouped by area: **SC** study config, **AUD** auditor experience, **EVAL** evaluation data capture, **DASH** dashboard & data, **MOD** models & relay, **SEC** accounts/roles/isolation, **DEP** deployment.
### 5.1 Study configuration (SC)
The study config is the backbone: an investigator defines the whole study here before recruiting.
| ID | Requirement | Priority | Acceptance criterion |
|----|-------------|----------|----------------------|
| SC-1 | Create and edit a study | MVP | An investigator can create a study, edit its config, and save; the saved config fully determines the auditor experience. |
| SC-2 | Configure conversation-control mode | MVP | Investigator can choose one of two **live** modes: seed prompt → free chat; fixed first chatbot turn → free chat (semantics per §6.6). Both keep the model live. The chosen mode is enforced for auditors. (Fully-scripted/canned turns are **Later** — see §9 D2; the `scripted` enum value is reserved but not shipped.) |
| SC-3 | Configure model(s) | MVP | Investigator can set provider, model id, system prompt, and decoding parameters; auditors are served exactly that configuration. |
| SC-4 | Configure time/turn limits | MVP | Investigator can set a per-conversation limit and an overall limit; both are enforced (server-side, see MOD-4). |
| SC-5 | Configure number of conversations per auditor | MVP | Investigator sets N; an auditor's session expects N conversations before "finish." |
| SC-6 | Select enabled evaluation methods | MVP | Investigator can independently enable/disable turn-level reactions (and which reaction types), the post-conversation questionnaire, and span highlighting. |
| SC-7 | Author the audit questionnaire | MVP | The in-house authoring UI exposes a fixed tier (§9 D1): single-choice, multiple-choice, Likert/rating scale, **Likert matrix/grid**, short and long free-text; plus page breaks, per-question instructions, a required toggle, and basic conditional visibility (show Q if a prior answer = X). Everything beyond that (complex validation, expressions, dynamic panels, piping, custom widgets) is reached via the **raw-JSON escape hatch**. Forms are stored as SurveyJS JSON regardless of how they were authored — the UI edits a subset of that same object, and "drop to raw JSON" edits the same schema, not a format conversion. **Any imported/edited JSON is validated against the Form Library before save** so a malformed schema can't brick an auditor session. |
| SC-8 | Start from bundled audit templates | MVP | At least one fairness and one bias template ship as ready-to-use questionnaire schemas the investigator can adopt and edit. |
| SC-9 | Optional consent text | MVP | Investigator can attach consent text; if present, it is shown to auditors and agreement is recorded (AUD-3). If absent, no consent gate is imposed. |
| SC-10 | Generate access code / join link | MVP | Investigator can generate a code/link that routes auditors into this study's config. |
| SC-11 | Study lifecycle state | MVP | A study can be at least **open** or **closed**; a closed study accepts no new sessions. |
| SC-12 | Configure two models for comparison (Arena) | V1 | Investigator can attach two model configs for blind pairwise comparison. |
| SC-13 | Capture launch URL parameters (opt-in) | MVP | Per-study toggle (**default off**, §9 D7). When on, the auditor session captures arbitrary launch query params (e.g. `?PROLIFIC_PID=...`) verbatim into `AuditorSession.launch_metadata`, kept separate from audit data and included in the export. Opaque (params are not interpreted); no auto-redirect/completion code (that is the deferred Prolific loop, AUD-10). Because it links a session to a pseudonymous identity (cutting against anonymous-by-default), when enabled it must be disclosed in consent. |
### 5.2 Auditor experience (AUD)
| ID | Requirement | Priority | Acceptance criterion |
|----|-------------|----------|----------------------|
| AUD-1 | Anonymous join | MVP | An auditor can enter via code/link and begin without creating an account. |
| AUD-2 | Optional account | MVP | An auditor may create/use an account; their session(s) associate with it. |
| AUD-3 | Consent gate (when configured) | MVP | If consent text is configured, the auditor must view it and explicitly agree before the first conversation; agreement is recorded with consent version and timestamp on the session. |
| AUD-4 | Live chat under config | MVP | Auditor chats with the configured model under the configured control mode; remaining time/turns are visible; limits stop the conversation cleanly. |
| AUD-5 | Turn-level reactions (when enabled) | MVP | When enabled, the auditor can attach the enabled reaction types (thumbs up/down, star, flag, comment) to individual chatbot messages during the conversation. |
| AUD-6 | End-and-audit | MVP | Auditor ends a conversation and completes the configured audit: questionnaire responses, span highlights with free-text explanations. |
| AUD-7 | Multiple conversations then finish | MVP | Auditor completes the configured number of conversations and reaches a finish state. |
| AUD-8 | Resume in-progress session | MVP | After a refresh or transient disconnect, the auditor returns to their place without losing prior turns or completed audits (reconstructed from the event log + persisted responses). |
| AUD-9 | Blind pairwise choice (Arena) | V1 | Auditor sees two responses labeled neutrally (e.g., A/B) and selects the better one; the side→model mapping is never shown to the auditor but is stored. |
| AUD-10 | Completion handoff (Prolific) | Later | On finish, redirect to a configured completion URL / show a completion code. |
### 5.3 Evaluation data capture (EVAL)
These specify what gets recorded; configuration lives in SC, the auditor-facing behavior in AUD. See §6 for the conceptual treatment.
| ID | Requirement | Priority | Acceptance criterion |
|----|-------------|----------|----------------------|
| EVAL-1 | Capture turn reactions | MVP | Each reaction is stored with session, conversation, target message id, reaction type, value, optional comment, and timestamp. |
| EVAL-2 | Capture questionnaire responses | MVP | The questionnaire renders from its schema and responses are stored against the schema, keyed to the conversation. |
| EVAL-3 | Capture span annotations (free text) | MVP | Each annotation stores the target message id, start/end offsets, the quoted substring, and the free-text explanation; offsets are stable against the stored message text (§6.4). |
| EVAL-4 | Span category taxonomy | Later | Investigator can define a label set; annotations can carry a category in addition to free text. |
| EVAL-5 | Capture pairwise preference | V1 | Each decision stores the pairing, the scope (per-turn and/or overall), the chosen side, the stored side→model mapping, and optional rationale. |
| EVAL-6 | Conversation as append-only event log | MVP | Every conversation is persisted as an append-only event log from which both the rendered UI and the exact payload sent to the model are derived; the stimulus is fully reconstructable. |
### 5.4 Investigator dashboard & data (DASH)
| ID | Requirement | Priority | Acceptance criterion |
|----|-------------|----------|----------------------|
| DASH-1 | Session/conversation list | MVP | Investigator sees sessions and their conversations with status (in progress / complete). |
| DASH-2 | Per-session drill-down | MVP | Investigator can open any session and see the full conversation plus that session's reactions, annotations, and questionnaire responses. |
| DASH-3 | Basic aggregate graphs | MVP | Investigator sees simple counts/distributions across the study — e.g., how many auditors flagged a given item, Likert response distributions. |
| DASH-4 | Export all data | MVP | Investigator can export the whole study's data as **both CSV and JSON**, in a tidy/long shape (one row per rating / reaction / annotation) suitable for R/Python. |
| DASH-5 | Near-real-time observability | Later | Investigator can watch in-progress sessions update live (Supabase realtime). |
| DASH-6 | Richer in-app analysis | Later | Cross-tabs, inter-rater views, filtering beyond basic distributions. |
### 5.5 Models & relay (MOD)
| ID | Requirement | Priority | Acceptance criterion |
|----|-------------|----------|----------------------|
| MOD-1 | Server-side model access | MVP | All model calls go through the relay; **for self-host / real studies no API key is ever exposed to the browser** (deployer keys live in the relay env). The hosted-demo BYO-key flow (MOD-8) is a scoped exception: the key is the *visitor's own*, lives in their browser, and is never persisted by the operator — the invariant that *the operator never owns or stores keys* holds everywhere. |
| MOD-2 | Supported providers at launch | MVP | The relay supports, tested and documented: **Ollama** (local, no key), **privately-hosted models via vLLM** (OpenAI-compatible endpoint), **OpenAI, Anthropic, and Gemini**. The model config UI shows **provider-specific fields** (base URL for Ollama/vLLM; API key for the cloud providers). **Self-host key handling (decision 2026-06-30):** for self-hosted studies, API keys are entered in the study config UI and stored with the study (sent to the relay per request) — a pragmatic deviation from the strict "keys server-side" reading of MOD-1, chosen so the single-container relay works without extra env wiring. The hosted-demo BYO-key flow (MOD-8) is unchanged. |
| MOD-3 | Apply per-study model config | MVP | The relay applies the study's system prompt and decoding parameters to each call. |
| MOD-4 | Enforce limits server-side | MVP | Per-conversation and overall time/turn limits are enforced at the relay/server, not only in the UI. |
| MOD-5 | Parallel dispatch for Arena | V1 | The relay sends the same context and user turns to two models in parallel and returns both responses for blind presentation. |
| MOD-6 | Image generation | Later | The relay can request image generation from a configured model. |
| MOD-7 | Per-study & per-session request ceilings | MVP | The relay enforces a simple **request-count** ceiling per study and per session; on hit it refuses further calls and surfaces "limit reached." No token accounting, no real-time cost estimation, no billing integration (out of scope). |
| MOD-8 | Per-request BYO key (hosted demo) | MVP | On the hosted demo the relay accepts a visitor-supplied provider key on each request, uses it in-memory for that single upstream call, and **never writes it to disk/DB or logs** (keys explicitly redacted in logging/error paths). TLS only. |
### 5.6 Accounts, roles & data isolation (SEC)
| ID | Requirement | Priority | Acceptance criterion |
|----|-------------|----------|----------------------|
| SEC-1 | Investigator accounts | MVP | Investigators can sign up and log in. |
| SEC-2 | Anonymous auditor sessions | MVP | Auditors get a usable session via Supabase anonymous sign-in, no account required. |
| SEC-3 | Per-study roles/membership | MVP | A person's role is defined per study via membership; no global role is assumed. |
| SEC-4 | Data isolation via RLS | MVP | A study's data is readable only by its investigators; an auditor can access only their own session's data. Enforced by Postgres Row-Level Security. |
| SEC-5 | Image storage | Later | Generated/annotated images stored in Supabase Storage under the same isolation rules. |
### 5.7 Deployment (DEP)
| ID | Requirement | Priority | Acceptance criterion |
|----|-------------|----------|----------------------|
| DEP-1 | Turnkey self-host (Docker) | MVP | A research group can stand up frontend + relay + Supabase via a documented Docker setup and run a study on their own infrastructure with their own keys. |
| DEP-2 | Local / no-backend trial mode | MVP | The app runs against browser-local storage (IndexedDB) for development, offline trial, and component embedding. This is a single-user/dev mode, **not** the multi-auditor study path (see §9). |
| DEP-3 | Hosted demo instance | MVP | A publicly reachable instance lets people try the tool with throwaway data; explicitly **not** for real human-subjects data (§8.1). Guardrails (§9 D5): short throwaway-data TTL (24h–7d, auto-purged); persistent "demo only — do not enter real participant data" banner; per-IP/session rate limits + a cap on conversations per visitor; no-signup. Commercial providers via BYO-key only (MOD-8), optional one zero-key operator-funded open model. Export may be disabled on the demo so it reads as a sandbox. |
| DEP-4 | Publishable npm component | V1 | The audit experience is packaged as an embeddable component other React apps can install and use (requires the library build from §7.1). |
| DEP-5 | Multi-language UI | Later | UI strings are externalized and translatable. |
### 5.8 Experience & visual design (UX)
The MVP prioritized getting the flows working; it is not yet visually polished and the movement between steps is rough rather than smooth. **V1 makes the tool significantly more refined visually and the flows noticeably more continuous.** This is not cosmetic for the auditor side: because auditors are typically crowd-recruited and time-boxed, a confusing or janky flow costs completion and data quality. So the **auditor experience is the priority surface** for this work, with the investigator surfaces (study config, dashboard) following. This effort pairs naturally with the CRA → Vite migration and the in-house authoring UI (§7.1), and must not regress the accessibility targets in §8.2 — polish and WCAG 2.1 AA are complementary (contrast, focus states, legible controls), not competing.
| ID | Requirement | Priority | Acceptance criterion |
|----|-------------|----------|----------------------|
| UX-1 | Cohesive visual design system | V1 | A deliberate, consistent design language (typography, color, spacing, components) is applied across all primary screens; no screen reads as unstyled/default. |
| UX-2 | Smooth auditor flow | V1 | A first-time auditor moves through join → consent → chat → audit → next conversation → finish with clear, continuous transitions, no jarring jumps or dead-ends, and preserved state (cf. AUD-8). |
| UX-3 | Considered interaction states | V1 | Every primary view has designed loading, empty, in-progress, error, and completion states — including streaming feedback in chat, submit/save confirmation, and clear limit/countdown display. |
| UX-4 | Polished core interactions | V1 | The task-central interactions — chat, turn reactions, span highlighting, questionnaire, A/B choice — are visually clear and legible; the questionnaire is styled consistently with the app rather than bare Form Library defaults. |
| UX-5 | Responsive, clean layout | V1 | Primary auditor and investigator screens are uncluttered and usable on standard laptop and typical smaller viewports. |
---
## 6. Evaluation methods (the core)
This is the heart of the product: the kinds of judgments auditors make, how each is configured per study, and how the resulting data is structured so it can actually be analyzed. A guiding design fact runs through all of it (§6.6): when conversations are free-form, every auditor is judging a *different* stimulus.
### 6.1 Turn-level reactions (in-chat, lightweight, formative)
While chatting, the auditor can react to individual chatbot messages: thumbs up/down, star, flag, free-text comment. These are quick, in-the-moment signals, not a structured instrument. The investigator chooses whether reactions are enabled at all and which types are available, independently of the post-conversation audit.
- **Configured by:** SC-6 (enabled, which types).
- **Data shape:** one record per reaction — `{session, conversation, message_id, type, value, comment?, timestamp}`. Naturally tidy; exports one row per reaction.
### 6.2 Post-conversation questionnaire (summative)
After ending a conversation, the auditor completes a questionnaire: Likert scales, single/multiple choice, free text, organized into pages with instructions. The investigator either authors this from scratch in the in-house authoring UI or starts from a bundled fairness/bias template. Forms are defined as **SurveyJS-compatible JSON** and rendered by the MIT SurveyJS Form Library (§7.1).
- **Configured by:** SC-7 (authoring), SC-8 (templates).
- **Data shape:** the native response object stored against the schema, **plus** a flattened tidy export — one row per `{session, conversation, question_id, answer}`. Free-text answers are preserved verbatim.
### 6.3 Span highlighting (localized critique)
The auditor selects a span of the chatbot's text and attaches a free-text explanation of what's wrong with it. This localizes a judgment to specific words rather than a whole message. In this version it is **free text only**; an investigator-defined category taxonomy is a Later feature (EVAL-4) — adding it does not change the capture model, only adds a label field.
- **Configured by:** SC-6 (on/off).
- **Data shape:** one record per annotation — `{session, conversation, message_id, start_offset, end_offset, quoted_text, explanation, label?}`. See §6.4 for offset stability.
### 6.4 Span-offset stability (a correctness requirement, not a nicety)
Highlights are character offsets into a specific chatbot message. For offsets to remain valid:
- **Index the canonical stored string** from the event log — not the rendered DOM and not the streaming buffer.
- **Streaming is not in the highlight path.** Highlighting happens in the post-hoc audit on an already-finalized message, so the only real threat is markdown rendering shifting positions — not streaming.
- **Render highlights by slicing the source string**, not by annotating over rich-rendered HTML. Compute offsets against the canonical string and render from that same string.
- **Belt-and-suspenders:** store `quoted_text` with every annotation and assert `canonical[start:end] === quoted_text` on read; on mismatch, **flag — do not silently render.**
This keeps annotations meaningful across resume (AUD-8), re-render, and export (§9 D6).
### 6.5 Pairwise model preference (V1, Arena-style)
Two models answer the **same auditor inputs in parallel**; the auditor sees both responses labeled neutrally (A/B) and picks the better one, blind. The side→model mapping is stored but never shown to the auditor.
- **Configured by:** SC-12 (two model configs).
- **Granularity (resolved, §9 D3):** **per-turn is the core signal** (a label on each exchange), with an **optional single overall judgment at the end**, configurable per study (default per-turn).
- **Independent parallel threads (correctness rule):** the two models keep **separate, independent histories**; both respond to **every** subsequent auditor turn (two parallel threads sharing the auditor's inputs, LMArena-style). A per-turn preference is *only a label* — **the chosen side must never become the context fed forward** to either model. Forking context on the winner is the classic Arena-with-conversation bug; do not do it.
- **Data shape:** one record per decision — `{pairing_id, scope: turn|overall, target_turn?, chosen_side, side_to_model_map, rationale?}`.
### 6.6 Conversation-control modes and what they mean for analysis
The investigator chooses how controlled the conversation is (SC-2). The trade-off is direct: **more control → more comparable stimuli → easier cross-auditor aggregation; less control → more realistic interaction → richer "what do people actually notice" data, but harder to aggregate.**
- **Seed prompt → free chat:** investigator sets an opening framing or first user prompt; the auditor then chats freely. Most realistic, least comparable.
- **Fixed first chatbot turn → free chat:** the chatbot's opening message is investigator-authored; the rest is free.
- **Scripted turns (Later, §9 D2):** fully-scripted/canned chatbot turns — where the auditor's replies don't change the bot — are **deferred**, bundled with static/pre-generated stimuli (which they are a variant of). They carry a validity problem (auditors notice their input doesn't affect the bot) and break "live interaction only." Not shipped this version; the `scripted` enum value is reserved so re-adding it later is non-breaking.
Because the control mode determines stimulus comparability, the tool **records the control mode and the seed/script** with each conversation so analysts can stratify or filter. This is what makes free-form data usable rather than just noisy: you can always recover what the auditor was reacting to.
### 6.7 Two judgment timescales, one dataset
Turn-level reactions (formative, mid-conversation) and the post-conversation audit (summative) are configured independently and can be used together, either alone, or not at all — under the same study setup. They write to the same study dataset but as distinct record types, so an analyst can use them separately or join them on `conversation` / `message_id`.
---
## 7. Data model / key entities (conceptual)
Conceptual entities and their relationships — not a schema. A deliberate modeling choice runs through it: **the conversation (the stimulus) is kept separate from the evaluation data about it.** The conversation is the append-only event log; reactions, annotations, questionnaire responses, and preferences reference messages in that log but are their own records. This keeps "what the auditor saw" cleanly separable from "what the auditor judged," which is exactly the separation analysis needs.
- **User / Account** — optional for auditors, required for investigators.
- **Study** — top-level container, owned by one or more investigators.
- **StudyConfig** — the backbone (§2.1): conversation-control mode + seed/first-turn, model config(s), enabled evaluation methods, time/turn limits, conversation count, consent text. Treat as versioned so that data can be tied to the exact config in force when it was collected. (Implementation note: the **lifecycle state** `draft|open|closed` is persisted on the **Study record's `status`** — the queryable field the join gate and dashboard use — rather than inside the config blob; config describes the auditor experience, not the publication state.)
- **Membership / Role** — links a User to a Study with a role (investigator | auditor). Per study.
- **AuditorSession** — one auditor's run through one study: assigned/expected conversations, progress, completion, the consent record, and (when SC-13 is on) a `launch_metadata` JSON field holding opaque launch query params, kept separate from audit responses.
- **Conversation** — belongs to a session; an append-only **event log**. Records its **provenance** for analysis (§9 D9): the control mode, the seed / first-turn text, and the **model config id + version** used.
- **Event / Message** — entries in the log (seed/system, user turn, chatbot turn). The rendered UI and the model payload are both derived from these.
- **TurnReaction** — references a Message; type/value/comment/timestamp.
- **AuditResponse** — questionnaire responses for a Conversation, stored against the schema.
- **SpanAnnotation** — references a Message; offsets + quoted text + explanation (+ label, Later).
- **ModelConfig** — provider, model id, system prompt, decoding params. One per study, or two for Arena.
- **ComparisonPairing (V1)** — the pairing of two ModelConfigs for a Conversation and the auditor's preference decision(s), including the stored side→model mapping.
- **ConsentRecord** — consent version, agreement, timestamp; on the session. Present only when the study configures consent.
- **Export (derived)** — tidy/long CSV and JSON projections over the above (not stored state). Every row carries **provenance columns** (§9 D9): control mode, seed/first-turn text (and script id if ever used), and model config id+version, so analysts can stratify by condition. When SC-13 is on, `launch_metadata` is included too.
---
## 8. Non-functional requirements
### 8.1 Privacy, consent, IRB, and data-controller stance
This is the part with real obligations attached, so the stance is explicit:
- **The tool is infrastructure, not a data controller.** IRB approval and data governance are the responsibility of **whoever runs the study**. The project maintainers do not act as data controller for anyone else's research.
- **Consent is investigator-supplied and optional.** If a study configures consent text, the tool renders it and records timestamped agreement (with consent version) on the session before the first conversation. The tool does **not** impose a consent regime of its own.
- **The hosted demo is a try-it-out instance only.** It uses throwaway data and is explicitly **not** for real human-subjects studies. Anyone running a real study is expected to **self-host privately** (DEP-1) so they own their data and keys. The hosted instance must say this plainly to visitors.
- **Hosted-demo commercial models are BYO-key (§9 D5).** Visitors may use OpenAI/Anthropic/Gemini by supplying their *own* API key, stored only in their browser (localStorage), used in-memory by the relay for the single upstream call, and never persisted/cached/logged server-side (MOD-8). This shifts all commercial-API cost and key ownership to the visitor and removes the operator's cost/abuse exposure. The truthful disclosure is **"we never store your key,"** not "your key never reaches our server." An operator may optionally also offer one operator-funded hosted open model (vLLM) as a zero-key default, kept under hard rate caps as the only operator-funded path.
- **No PII is required from auditors.** Anonymous join is the default. If an investigator chooses to collect identifying information through their own questionnaire, that is their responsibility under their IRB, and such data lives only in their self-hosted instance.
### 8.2 Accessibility
Target **WCAG 2.1 AA**. The SurveyJS Form Library gives a head start on the questionnaire surface, but it does not cover the bespoke surfaces, which need dedicated accessibility work:
- **Live chat** — keyboard operability, screen-reader announcement of new messages, visible limit/countdown state conveyed non-visually.
- **Span highlighting** — the hardest case: selecting and labeling a text span must be achievable without a mouse and must be intelligible to a screen reader. This needs explicit design, not a default.
- **Turn-level reactions** and **Arena A/B choice** — labeled controls, focus management.
Accessibility is stated here as a requirement and a target, not a claim about the current build.
### 8.3 Performance & scale
Studies are expected to run with **tens to low-hundreds of auditors**, possibly concurrent during a recruitment batch. Implications:
- The relay must handle concurrent (and, for chat, streaming) requests across those auditors.
- The append-only event log must support smooth resume (AUD-8) without expensive reconstruction.
- Near-real-time observability is deferred to **Later** partly because watching many concurrent sessions is materially heavier than the rest of the dashboard; the MVP dashboard reads completed/aggregate data instead.
### 8.4 Security
- API keys server-side only for self-host / real studies, never in the browser (MOD-1). The hosted-demo BYO-key flow (MOD-8, §9 D5) is the one scoped exception: the visitor's own key, in their browser, never persisted/logged by the operator.
- Per-study data isolation enforced by Postgres RLS (SEC-4), not only in application code.
- Anonymous auditor sessions scoped to their own data.
### 8.5 Deployment modes (recap)
Three modes, with clear boundaries: **self-hosted** (DEP-1, the real study path), **local/no-backend** (DEP-2, dev/trial/embedding, single-user), and **hosted demo** (DEP-3, throwaway, not for real subjects). The **npm component** (DEP-4, V1) is a fourth distribution form for embedding into others' React apps.
---
## 9. Resolved scoping decisions
These were the open questions most likely to cause rework. They are now **resolved** (2026-06-29); the decision and its build deltas are recorded here and reflected in the requirements above. IDs (**D1–D9**) are referenced throughout the spec.

**D1 — Authoring UI vs. SurveyJS coverage.** The in-house authoring UI tier is pinned (SC-7): single-choice, multiple-choice, Likert/rating scale, **Likert matrix/grid**, short and long free-text, page breaks, per-question instructions, required toggle, basic conditional visibility (show Q if prior answer = X). Everything else (complex validation, expressions, dynamic panels, piping, custom widgets) is the **raw-JSON escape hatch**. Architectural point: forms are stored as SurveyJS JSON regardless of authoring path — the UI is a generator/editor of a *subset* of that same object, and "drop to raw JSON" edits the same schema, not a format conversion. **Validate imported/edited JSON against the Form Library before save.** The matrix/rating type must be in the UI tier — the bundled fairness/bias templates lean on it.

**D2 — Conversation-control modes.** Ship only **two live modes**: `seed_prompt` and `fixed_first_turn` (both keep the model live; both satisfy "live interaction only"). **Fully-scripted/canned turns are deferred to Later**, bundled with static/pre-generated stimuli (a variant of), and carry a validity problem (auditors notice their replies don't affect the bot). Build deltas: SC-2 enum = `[seed_prompt, fixed_first_turn]` — `scripted` removed from enum/UI/validation but the name reserved (re-adding later is non-breaking); no script editor or dialogue-tree UI in Phase B; every conversation calls the live model — no model-bypass path in the relay; still record control mode + seed/first-turn text per conversation. Net: Phase B is simplified.

**D3 — Arena preference granularity.** **Per-turn is the core signal** (a label on each exchange), with an **optional single overall judgment at the end**, configurable per study (default per-turn). Relay correctness (MOD-5): the two models keep **independent histories** and both respond to every subsequent auditor turn (two parallel threads sharing the auditor's inputs). A per-turn preference is only a label — **the chosen side must never become the context fed forward**.

**D4 — Cost controls.** Enforce a simple **per-study request ceiling + per-session ceiling** at the relay (MOD-7); on hit, refuse further calls and surface "limit reached." Request-count is sufficient (turn limits × conversations × auditors already bounds usage); the runaway risks are more auditors than expected and the public demo. **No** token accounting, real-time cost estimation, or billing integration. Plus a hard global cap on the hosted demo (D5).

**D5 — Hosted-demo guardrails & BYO-key.** Commercial providers **are** available on the demo, but **only via visitor-supplied keys** (never operator keys): the key is stored in the visitor's browser (localStorage), used in-memory by the relay for the single upstream call, and never persisted/cached/logged server-side (MOD-8). This shifts cost and key ownership to the visitor and removes the operator's exposure — so the earlier "disable commercial providers on the demo" is moot. Keep: short throwaway-data TTL (24h–7d, auto-purged), persistent "demo only — do not enter real participant data" banner, per-IP/session rate limits + a cap on conversations per visitor, no-signup. Optional: one operator-funded hosted open model (vLLM) as a zero-key default, kept under hard rate caps. Export may be disabled on the demo. MOD-1 still holds for self-host/real studies; the demo BYO-key flow is a scoped exception where the operator never owns or stores keys. Truthful disclosure: **"we never store your key,"** not "your key never reaches our server." Touches Phase E (deploy) + a small Phase D (relay accepts per-request keys).

**D6 — Span-offset stability.** Implementation rule (§6.4): offsets index the **canonical stored message string** from the event log — not the rendered DOM, not the streaming buffer. De-risking insight: highlighting happens in the post-hoc audit on an already-finalized message, so **streaming is not in the highlight path** — the only real threat is markdown rendering shifting positions. Avoid it by computing offsets against the source string and rendering highlights by **slicing that same string** (don't annotate over rich-rendered HTML). Belt-and-suspenders: store `quoted_text` and assert `canonical[start:end] === quoted_text` on read; mismatch = flag, don't silently render.

**D7 — External-recruitment bridge.** **Yes**, capture launch URL query params into `AuditorSession.launch_metadata` (JSON), kept separate from audit responses and included in the export (SC-13). **Opt-in per study, default off** (capturing `PROLIFIC_PID` links a session to a pseudonymous identity, cutting against anonymous-by-default); when on, disclose in consent. Keep params **opaque** (don't interpret them); no auto-redirect/completion-code yet (that is the deferred loop, AUD-10).

**D8 — Local-mode boundary.** Confirmed: IndexedDB is **non-syncing dev/trial/embedding only** — *not* offline-then-sync. True local-first sync (a sync engine with conflict resolution against Postgres) is a large, separate project that multi-auditor studies don't need; real studies use the Supabase backend. Document the boundary so nobody expects browser-local demo data to land on a server. If local-first sync ever becomes a goal, it is its own major initiative, not an extension of this mode.

**D9 — Stimulus comparability vs. aggregation.** Not a code fix — a **provenance discipline**. Record per conversation the control mode, the seed/first-turn text (and script id if ever used), and the model config id+version; surface all of these as **columns on every export row** so analysts can stratify by condition (Phase E). The event-log model already captures this; the work is making the export expose it, plus one line in the investigator docs: free-chat data is aggregable *within* a condition, but cross-auditor comparisons must account for stimulus variance, and tight comparability means using `fixed_first_turn` (or, later, scripted/static stimuli).
---
## 10. Appendix
### 10.1 Glossary
- **Investigator** — researcher who configures and runs a study; owns its IRB.
- **Auditor** — recruited participant who interacts with the chatbot and judges it.
- **Study / StudyConfig** — the unit of research and its full configuration.
- **Audit** — the structured judgment an auditor makes about a conversation (questionnaire + span highlights, and/or in-chat reactions).
- **Conversation event log** — the append-only record from which the UI and the model payload are derived.
- **Turn reaction** — a lightweight in-chat signal on one chatbot message.
- **Span annotation** — a highlighted span of chatbot text plus an explanation.
- **Conversation-control mode** — how scripted/seeded the conversation is (§6.6).
- **Relay** — the server that holds model API keys and forwards chat (MOD).
- **Arena** — blind pairwise comparison of two models (V1).
- **Tidy/long export** — one row per observation (rating / reaction / annotation), the analysis-friendly shape.
### 10.2 Priority summary
| Area | MVP | V1 | Later |
|------|-----|----|-------|
| Study config | Full config backbone, control modes, model config, limits, methods toggles, questionnaire authoring + templates, optional consent, access code, open/closed | Two-model config (Arena) | — |
| Auditor | Anonymous join, optional account, consent gate, live chat + limits, turn reactions, end-and-audit, multi-conversation finish, resume | Blind A/B choice | Prolific completion handoff |
| Evaluation capture | Reactions, questionnaire responses, free-text span annotations, event log | Pairwise preference | Span taxonomy |
| Dashboard & data | Session list, drill-down, basic graphs, CSV+JSON tidy export | — | Real-time observability, richer analysis |
| Models & relay | Server-side keys, vLLM+OpenAI+Anthropic+Gemini, per-study config, server-side limits, per-study/session request ceilings, demo BYO-key | Parallel dispatch (independent threads) | Image generation |
| Accounts/roles | Investigator accounts, anonymous sessions, per-study roles, RLS isolation | — | Image storage |
| Deployment | Turnkey Docker self-host, local trial mode, hosted demo | npm component | Multi-language |
| Architecture | Migrate CRA → Vite; MIT Form Library + in-house authoring UI | Library build for the component | — |
| Experience & visual design | Flows functional but unpolished | Cohesive design system, smooth auditor flow, considered states, polished core interactions, responsive layout | — |
### 10.3 Example study config (illustrative)
A small fairness study, free-chat with a seed prompt, single model, reactions + questionnaire + highlighting on, consent attached. Illustrative shape only.
```yaml
study:
  title: "Fairness audit — hiring assistant"
  state: open
  conversations_per_auditor: 2
  limits:
    per_conversation_minutes: 10
    overall_minutes: 30
  conversation_control:
    mode: seed_prompt        # seed_prompt | fixed_first_turn  (scripted reserved, Later — §9 D2)
    seed_prompt: "You are a hiring assistant helping screen candidates."
  models:
    - role: primary          # second entry would enable Arena (V1)
      provider: vllm          # vllm | openai | anthropic | gemini
      model_id: "org/model-name"
      system_prompt: "..."
      decoding: { temperature: 0.7, top_p: 0.95, max_tokens: 1024 }
  evaluation:
    turn_reactions:
      enabled: true
      types: [thumbs, flag, comment]
    questionnaire:
      schema_ref: "templates/fairness.surveyjs.json"   # or a custom schema
    span_highlighting:
      enabled: true
      taxonomy: null         # free text only (taxonomy = Later)
  consent:
    text_ref: "consent/hiring-study.md"   # null = no consent gate
```
