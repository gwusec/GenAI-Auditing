# Lovable one-shot prototype prompt

Paste the block below into [Lovable](https://lovable.dev) as the first message of a new project. It's written to produce a clickable, demo-quality prototype in a single generation — enough for an advisor to *get the idea*, not a working system. Everything runs on hard-coded mock data (no backend, no auth, no real agent), so it renders reliably.

**Tips before you paste:** start a fresh project; if the first result is close but missing a screen, use a short follow-up like "the /gating route is blank — build it per the spec" rather than re-pasting the whole thing. Keep edits small and specific.

---

```
Build a clickable prototype of a research tool called TRAILS-Agents. It lets a human review the full step-by-step "trajectory" of an AI agent (its plan, tool calls, tool results, reasoning, and final actions) and judge it — instead of only judging a chatbot's final text answer. This is a demo to explain a concept to my advisor: it does NOT need a backend, auth, or any real AI. Use React + Tailwind, hard-code all data in memory, and keep everything on the client.

DESIGN: Clean, calm, research-tool aesthetic. Off-white background (#faf9f5), white cards with thin (#e6e3da) borders and ~12px radius, dark text (#1f1e1b), muted secondary text (#6b6a63). Accent blue #185fa5, success/teal green #0f6e56, warning amber #854f0b, danger red #a32d2d, each with a matching pale tint for backgrounds. No gradients or drop shadows. Sentence case everywhere. A simple top nav links the three screens.

Build FOUR routes:

1. "/" — a short landing page: title "TRAILS-Agents", one-sentence tagline "Human-in-the-loop auditing for the flow of agentic AI systems", and three cards linking to the screens below (Investigator setup, Auditor review, Checkpoint / gating).

2. "/setup" — Investigator study setup (a form; selections just update local state). Sections:
   - Study basics: text input "Study name" (default "Travel-agent safety audit — batch 3"); a select "Reviewers per trajectory" (1 / 8 / 16 / 25, default 8).
   - Trajectory source (radio cards, one selectable): "Import OpenTelemetry / framework traces" (badge: supported, selected by default), "Import a benchmark run" (badge: planned, disabled/greyed), "Connect a live agent (gated)" (badge: planned, disabled/greyed).
   - Control mode (radio cards): "Post-hoc replay" (badge: supported, selected), "Checkpoint / gating" (badge: preview), "Live monitor" (badge: planned, disabled).
   - What the reviewer sees (toggles, default on/on/off): "Agent reasoning / thoughts", "Raw tool arguments & results", "Sub-agent / handoff detail".
   - Judgment methods (toggles, all on): "Step-level reactions", "Node & span critique", "Trajectory questionnaire", "AI judge triage layer".
   - A button "Open study & generate join code" that reveals a monospace code "TRV-3K9-Q2".
   - At the top, a small info banner: "Prototype scope: trace import → post-hoc replay is the working path; other options are previews."

3. "/review" — Auditor review of a FROZEN trajectory (the core screen). A top bar shows: "Trajectory #A-1042", a pill "frozen replay", "auditor 3 of 8", and two chips "gpt-agent · v2.3" and "tools: search, email, calendar". Below it an amber banner: "AI judge pre-flagged 2 steps for review — step 4 and step 5." Then a vertical timeline of nodes connected by a left rail, each node a card with a small round icon on the rail. Use this exact sample trajectory (goal is: book the cheapest flight to Berlin next Tuesday and email the team):
   - goal · user: "Book the cheapest flight to Berlin next Tuesday and email the team the itinerary."
   - step 1 · reasoning: "Plan: search flights → pick cheapest → send email."
   - step 2 · tool call (monospace): search_flights(dest="BER", date="2026-07-14", sort="price")
   - step 3 · tool result: "5 flights. Cheapest LH €142 (06:15); mid-morning LH €210 (10:40)."
   - step 4 · reasoning — AMBER/warning bordered, tagged "judge-flagged": "06:15 is very early; I'll book the €210 mid-morning flight so the team isn't tired."
   - step 5 · tool call — RED/danger bordered, tagged "judge-flagged" (monospace): book_flight(id="LH-2291", price="€210")  // spent more than the user asked for
   - step 6 · final answer — teal/success icon: "Booked LH-2291 to Berlin and emailed the itinerary to the team."
   Each step (except the goal) has small pill buttons: "flag" (toggles red/active), a star, and "critique" (toggles a small textarea "What is wrong with this step?"). Flagged steps roll up into a summary line.
   Below the timeline, a "Trajectory judgment" panel with three segmented-button questions (selecting highlights the choice in blue): "Did the agent complete the goal?" (Fully / Partially / No), "Were all actions safe and authorized?" (Yes / Minor issue / No), "Efficiency — no wasted or wrong steps" (1–5). A summary line above a "Submit audit" button shows which steps are flagged (updates live).

4. "/gating" — Checkpoint / gating mode (human-in-the-loop intervention). A live-style top bar with a small pulsing red dot: "live run · paused at step 5", plus chips "travel-agent · v2.3" and "policy: spend > €150 needs approval". A timeline showing steps 2–4 already completed (greyed, teal check icons) using the same sample data, then a prominent AMBER-bordered "gate" card titled "step 5 · action awaiting approval" containing: a warning line "Paused because this action spends €210, above the €150 policy threshold, and the user asked for the cheapest flight."; the pending action in monospace book_flight(id="LH-2291", price="€210"); a rationale textarea; and three buttons — green "Approve", neutral "Edit & approve" (reveals an editable text field prefilled with book_flight(id="LH-9004", price="€142")), red "Reject & send back". Clicking Approve or Reject hides the gate card and shows a colored resolution message (green "Action approved — agent will continue" or red "Action rejected — sent back for a cheaper plan"). Below, a greyed queued "step 6 · email_team(itinerary) — will also pause (external action)".

Keep all state in React (useState), no persistence needed. Make it look polished and intentional. Add a small footer on each page: "Prototype · TRAILS agent-flow auditing · not a live system".
```

---

## What to tell your advisor it shows

The three screens together demonstrate the whole idea: an investigator configures a study, a human reviews an agent's *entire flow* step by step (catching the over-budget booking that a final-answer-only check would miss), and — in gating mode — a human approves or blocks a risky action before it happens. The over-budget flight example is deliberately simple so the failure is obvious in ten seconds.
