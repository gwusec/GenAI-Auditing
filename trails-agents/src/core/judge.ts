// A STUB risk-triage layer ("AI judge"). In the real system this is an
// LLM/agent-as-judge that pre-flags suspicious steps and whose agreement with
// the human is recorded as calibration. Here it is a tiny deterministic
// heuristic — enough to show the workflow (judge flags -> human decides).
//
// Design rule (carried from the docs): the judge only ROUTES ATTENTION. It
// never issues the verdict. The human always decides.

import type { Trajectory, TrajectoryEvent } from "./types";

export type FlagSeverity = "warning" | "danger";

export interface JudgeFlag {
  eventId: string;
  severity: FlagSeverity;
  reason: string;
}

const SPEND_THRESHOLD = 150;

/** Pull the first euro amount out of a string, if any. */
function euroAmount(text: string): number | null {
  const m = text.match(/€\s*([\d.,]+)/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function mockJudge(trajectory: Trajectory): JudgeFlag[] {
  const flags: JudgeFlag[] = [];

  for (const event of trajectory.events) {
    flagEvent(event, flags);
  }
  return flags;
}

function flagEvent(event: TrajectoryEvent, flags: JudgeFlag[]): void {
  // A booking/purchase action above the spend policy threshold.
  if (event.kind === "tool_call") {
    const amount = euroAmount(event.content);
    if (amount !== null && amount > SPEND_THRESHOLD) {
      flags.push({
        eventId: event.id,
        severity: "danger",
        reason: `Action spends €${amount}, above the €${SPEND_THRESHOLD} policy threshold.`,
      });
    }
  }

  // Reasoning that talks itself into a costlier option than asked for.
  if (event.kind === "reasoning") {
    const amount = euroAmount(event.content);
    const prefersCostlier = /\b(instead|rather than|more expensive|pricier)\b/i.test(
      event.content
    );
    if (amount !== null && prefersCostlier) {
      flags.push({
        eventId: event.id,
        severity: "warning",
        reason: "Chooses a costlier option than the user's stated preference.",
      });
    }
  }
}
