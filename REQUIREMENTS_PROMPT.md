# Briefing prompt — paste this into a new Claude chat

> Copy everything below the line into a fresh Claude conversation. It's written
> in the first person so you can send it as-is (tweak anything that's not quite
> right). It asks Claude to interview you before writing the requirements doc.

---

I'm building an open-source research tool and I want your help turning a rough MVP into a proper, well-scoped **requirements / product spec document**. Before you write anything, please **interview me** — ask clarifying questions in small batches until you understand the product, the users, and the priorities. Only after that, draft the requirements doc. Don't rush to a solution.

## What the tool is

It's called the **TRAILS Chatbot Audit** tool. It's a web app for **human evaluation of AI chatbot responses** — specifically auditing chatbot outputs for **fairness, bias, and harm**. It comes out of academic AI-safety/trustworthy-AI research, and I'm preparing it for an **open-source release**. Think of it as an instrument for running structured human-subjects studies where people interact with an AI chatbot and then critique its responses, and researchers collect that data.

## The two types of users

1. **Investigators** (researchers): create and configure a *study*, then recruit/assign auditors and analyze the results.
2. **Auditors** (participants): take a study — usually joining **anonymously via a link or access code**, no account required. (They can optionally make an account.)

A single person can be an investigator on one study and an auditor on another. Roles are **per-study**, not global.

## The core auditor workflow (today)

An auditor:
1. Chats with an AI chatbot (there are time limits per conversation and overall).
2. Ends the conversation and then **audits** it: rating scales (Likert), **highlighting** specific problematic spans in the chatbot's text, and free-text explanations.
3. May do this for multiple conversations, then finishes.

The conversation is stored as an **append-only event log**, and the UI + the data sent to the model are derived from that log.

## What I want it to become (the wishlist)

- **Study configuration as the backbone**: an investigator defines everything about a study in one place — which model(s), which evaluation methods, seed prompts, time limits, consent text, number of conversations, etc.
- **Richer evaluation methods**: full questionnaire support (I was looking at SurveyJS), plus **in-chat, turn-level reactions** on individual messages (thumbs up/down, star, flag, add a comment).
- **Multi-model**: generate responses from **two models and let the auditor pick** the better one (Chatbot-Arena style); possibly more models/comparison later.
- **Image support**: image **generation** by the chatbot and **image-specific annotation** (marking regions of an image, not just whole-image ratings).
- **Investigator dashboard**: view/aggregate/analyze submitted audits, plus **live observability** — watch what auditors are doing in near-real-time on a hosted instance.
- **Data**: server-side persistence + export for analysis.
- **Accessibility** and eventually multi-language.
- **Two deployment modes**: a hosted beta (people can just try it) *and* full **self-hosting** for researchers who need data ownership (e.g., IRB/human-subjects). Also possibly publishable as an **npm component** others embed in their own React apps.

## Current state (honest)

There's a working but very early MVP:
- **Frontend**: React (Create React App) + Material-UI. Event-sourced conversation model. A questionnaire builder and an audit/highlight UI exist.
- **Backend options**: local browser storage (IndexedDB) by default, and an optional **self-hosted Supabase** (Postgres + Auth + Row-Level Security + Storage) for real multi-user data. There's also a small **relay server** (Node/Express) that forwards chat to the chosen model provider (Ollama for local models, or OpenAI/Anthropic/etc.) so API keys stay server-side.
- **Accounts/roles/studies** ("Feature 0") were just built as a first pass: investigators can sign up, create a study, author a questionnaire, generate an access code; auditors join anonymously with a code; there's a no-signup demo. Per-study roles and data isolation (via RLS) are in place.
- It functions end-to-end but feels like a **very initial MVP** — the flows are rough and I'm not confident the structure is heading in the right direction.

## Constraints / decisions already made

- **Open source** (Apache-2.0).
- **Supabase** is the chosen backend (it's open-source and self-hostable; it gives us auth, anonymous sign-in for auditors, per-study data isolation via RLS, storage for images, and realtime for live dashboards).
- **API keys never go in the browser** — the relay handles model calls server-side.
- Must support **both** a shared hosted instance and clean self-hosting (turnkey Docker).

## What I want from you

Help me produce a **clear requirements / product spec document** that I can actually build against. I'd like it to eventually include:
- A crisp problem statement and goals (and non-goals).
- **User personas** and **user stories** for investigators and auditors.
- A breakdown of **functional requirements**, grouped and **prioritized** (MVP vs. v1 vs. later), with **acceptance criteria**.
- The **data model / key entities** (studies, roles, conversations, annotations, etc.) at a conceptual level.
- **Evaluation-method requirements** — this is the heart of the product and I want it thought through carefully (what kinds of judgments auditors make, how they're configured per study, how the data is structured for analysis).
- **Non-functional requirements**: privacy/consent/IRB considerations, accessibility, performance, deployment modes.
- **Open questions and risks** I should resolve.

But **first, interview me.** Start by asking the most important clarifying questions — about the research goals, who the real users are, what "success" looks like, what's truly in scope for a first real version, and anything where my wishlist is ambiguous or over-broad. Ask 3–6 questions at a time, wait for my answers, and keep going until you have what you need. Then propose an outline for the requirements doc before writing the whole thing.
