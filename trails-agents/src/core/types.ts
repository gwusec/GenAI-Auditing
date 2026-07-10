// Core data model for TRAILS-Agents.
//
// Design invariant (carried over from TRAILS): the stimulus (the trajectory) is
// an append-only, ordered event log. Everything a reviewer sees is DERIVED from
// this log. Judgments about the log live as separate records, never mutating it.

/** The kinds of step a single agent trajectory can contain. */
export type EventKind =
  | "goal" // the user's request / task given to the agent
  | "plan_step" // an explicit planning step
  | "reasoning" // an internal thought / deliberation
  | "tool_call" // the agent invoking a tool
  | "tool_result" // the result returned by a tool
  | "subagent_spawn" // handing off to a nested agent
  | "subagent_result" // a nested agent returning
  | "final_answer"; // the agent's final response to the user

/** Provenance captured with every trajectory so analysts can stratify/filter. */
export interface Provenance {
  /** Where the trace came from, e.g. "otel-genai". */
  source: string;
  agentName?: string;
  agentVersion?: string;
  model?: string;
  system?: string;
  /** Tools the agent had available during the run. */
  toolsAvailable: string[];
  controlMode: "post_hoc_replay" | "checkpoint_gating" | "live_monitor";
  /** ISO timestamp of when the trajectory was ingested. */
  capturedAt: string;
}

/** One node in the append-only event log. */
export interface TrajectoryEvent {
  id: string;
  /** Parent event id, for sub-agent / nested spans. Undefined at the top level. */
  parentId?: string;
  kind: EventKind;
  /** Short human label, e.g. "tool call · search_flights". */
  title: string;
  /** Canonical text of the step (reasoning text, tool args, tool result, ...). */
  content: string;
  /**
   * Stable hash of `content`. Annotations reference an event id + this hash; on
   * read we assert the hash still matches so a highlight can never silently
   * drift onto changed text.
   */
  contentHash: string;
  /** Present for tool_call / tool_result events. */
  toolName?: string;
  /** ISO start time, if the source provided one. */
  startTime?: string;
}

/** A complete agent run, ready to be reviewed. */
export interface Trajectory {
  id: string;
  /** The user goal that started the run (also present as the first event). */
  goal: string;
  provenance: Provenance;
  /** Append-only, time-ordered. */
  events: TrajectoryEvent[];
}

// ---------------------------------------------------------------------------
// Minimal OpenTelemetry GenAI-shaped input. This is intentionally a small
// subset — enough to ingest a real-ish trace. Phase 0's whole job is to prove
// this mapping is clean; broader OTel coverage comes later.
// ---------------------------------------------------------------------------

export interface OtelSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  /** Nanoseconds since epoch, as OTel emits. */
  startTimeUnixNano: number;
  endTimeUnixNano?: number;
  attributes: Record<string, string>;
}

export interface OtelTrace {
  traceId: string;
  spans: OtelSpan[];
}
