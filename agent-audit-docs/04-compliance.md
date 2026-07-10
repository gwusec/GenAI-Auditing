# 04 · Compliance stance — the EU AI Act angle

## Why this section exists

Auditing agent flows is close to a regulatory requirement, not only a research nicety, and that materially expands who this tool is for. This document states how TRAILS-Agents relates to the EU AI Act — precisely, so we neither under-sell the fit nor over-promise something we can't deliver.

## What the Act asks for

For high-risk AI systems, the relevant duties are:

- **Article 14 — human oversight.** The system must be designed so a person can effectively oversee it and *intervene, interrupt, or stop* its operation, and can interpret its outputs.
- **Article 12 — logging / traceability.** The system must generate tamper-evident audit trails capturing inputs, outputs, and decisions in enough detail to trace what happened.
- **Article 19 — retention.** Deployers retain those logs for at least six months.

High-risk obligations become enforceable **August 2, 2026**, with penalties up to 7% of global turnover or €35M. Autonomous agents taking consequential actions — financial, medical, legal — are a leading candidate for high-risk classification, which is exactly the population TRAILS-Agents is built to review.

## How TRAILS-Agents maps onto those duties

The fit is direct, and it falls naturally out of the architecture in [`03-architecture.md`](03-architecture.md):

**Article 14 (intervene / interrupt / stop)** is the checkpoint/gating mode. The agent pauses before a policy-flagged action; a human approves, edits, or rejects it; the decision returns to the agent. That is "intervene, interrupt, or stop" implemented as a product feature, with the human able to interpret the action in full trajectory context before deciding.

**Article 12 (traceable record of decisions)** is the trajectory event log plus the `GateDecision` / `TrajectoryAudit` records. A frozen trajectory is already a complete, replayable record of the agent's inputs, outputs, and intermediate decisions; the human judgment attached to it — who reviewed it, what they flagged, what they approved or rejected, and why — is the oversight overlay. Together that is the "recorded trajectory plus documented human decision" artifact the Article is reaching for.

**Article 19 (retention)** is a deployment property of whoever self-hosts, supported by the tidy, exportable data model — not something the tool imposes.

## The stance: instrument, not compliance guarantor

This is the distinction to nail down early, and it is a direct extension of the existing TRAILS position ("the tool is infrastructure, not a data controller").

A tool cannot *make* anyone compliant. The EU AI Act's obligations fall on the **provider or deployer** of the agent, not on the vendor of a review instrument. What TRAILS-Agents provides is the **capability and the evidence**: the human-oversight mechanism (Article 14) and the auditable record of trajectory-plus-human-decision (Article 12). The deployer owns the compliance, the classification, the retention policy, and any conformity assessment.

Stated plainly, and to be repeated in product copy and consent text: *TRAILS-Agents gives a deployer a human-oversight instrument and an audit trail; it does not certify compliance, and it is not the data controller for the deployer's systems or data.*

This posture does three useful things. It is honest and legally defensible. It keeps us out of liability we shouldn't hold. And it cleanly defines the second audience: alongside research groups, there is a **governance / oversight buyer** who needs exactly this evidence-and-capability layer and is happy for the compliance responsibility to remain theirs.

## Consequences for the product

A few things follow that should be designed in rather than bolted on:

The **oversight artifact must be first-class** — a `GateDecision` and the trajectory it acted on should be exportable together as a self-contained, tamper-evident record, because that is the thing an auditor or regulator would ask to see.

**Provenance is not optional** for this audience — the model/agent version, tools available, and control mode captured with every trajectory are part of what makes the record traceable under Article 12.

And the **disclosure language** should mirror the TRAILS consent posture: state what the tool records and that oversight/compliance responsibility stays with the deployer, rather than implying the tool discharges a legal duty on their behalf.

## Caveat

This is a design-level reading of how the tool relates to the regulation, not legal advice, and the Act's implementing guidance continues to evolve. Any organization relying on TRAILS-Agents as part of a compliance process should have qualified counsel confirm classification and sufficiency for their specific deployment.
