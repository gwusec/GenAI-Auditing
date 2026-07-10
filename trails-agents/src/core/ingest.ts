// Phase 0: turn an OpenTelemetry GenAI-shaped trace into the internal
// append-only event log. This is the de-risking spike for the whole project —
// if this mapping is clean, everything downstream is derived from the log.

import { fnv1a } from "./hash";
import type {
  EventKind,
  OtelSpan,
  OtelTrace,
  Trajectory,
  TrajectoryEvent,
} from "./types";

const OP = "gen_ai.operation.name";

function makeEvent(
  partial: Omit<TrajectoryEvent, "contentHash">
): TrajectoryEvent {
  return { ...partial, contentHash: fnv1a(partial.content) };
}

function prettyArgs(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

/**
 * Normalize one OTel GenAI trace into a Trajectory.
 *
 * Mapping (subset of the GenAI semantic conventions):
 *   invoke_agent  -> provenance + a `goal` event from the input
 *   chat          -> `reasoning` | `plan_step` | `final_answer`
 *                    (disambiguated by the `trails.message_type` attribute)
 *   execute_tool  -> a `tool_call` event AND a `tool_result` event
 */
export function ingestOtelTrace(trace: OtelTrace): Trajectory {
  const spans = [...trace.spans].sort(
    (a, b) => a.startTimeUnixNano - b.startTimeUnixNano
  );

  const root = spans.find((s) => s.attributes[OP] === "invoke_agent");
  if (!root) {
    throw new Error(
      "ingestOtelTrace: no invoke_agent span found — cannot establish provenance."
    );
  }

  const toolsRaw = root.attributes["trails.tools_available"] ?? "";
  const goalText = root.attributes["gen_ai.input.messages"] ?? "";

  const provenance = {
    source: "otel-genai",
    agentName: root.attributes["gen_ai.agent.name"],
    agentVersion: root.attributes["gen_ai.agent.version"],
    model: root.attributes["gen_ai.request.model"],
    system: root.attributes["gen_ai.system"],
    toolsAvailable: toolsRaw
      ? toolsRaw.split(",").map((t) => t.trim()).filter(Boolean)
      : [],
    controlMode: "post_hoc_replay" as const,
    capturedAt: new Date().toISOString(),
  };

  const events: TrajectoryEvent[] = [];

  // The goal is always the first event, derived from the root span.
  events.push(
    makeEvent({
      id: `${root.spanId}:goal`,
      kind: "goal",
      title: "goal · user",
      content: goalText,
      startTime: isoFromNano(root.startTimeUnixNano),
    })
  );

  for (const span of spans) {
    if (span === root) continue;
    const op = span.attributes[OP];
    const startTime = isoFromNano(span.startTimeUnixNano);
    const parentId = span.parentSpanId;

    if (op === "chat") {
      const msgType = span.attributes["trails.message_type"] ?? "reasoning";
      const text = span.attributes["gen_ai.output.text"] ?? "";
      const kind: EventKind =
        msgType === "final"
          ? "final_answer"
          : msgType === "plan"
            ? "plan_step"
            : "reasoning";
      events.push(
        makeEvent({
          id: span.spanId,
          parentId,
          kind,
          title: labelFor(kind),
          content: text,
          startTime,
        })
      );
    } else if (op === "execute_tool") {
      const toolName = span.attributes["gen_ai.tool.name"] ?? "tool";
      const args = prettyArgs(span.attributes["gen_ai.tool.call.arguments"]);
      const result = span.attributes["gen_ai.tool.call.result"] ?? "";
      events.push(
        makeEvent({
          id: `${span.spanId}:call`,
          parentId,
          kind: "tool_call",
          title: `tool call · ${toolName}`,
          content: `${toolName}(${args})`,
          toolName,
          startTime,
        })
      );
      events.push(
        makeEvent({
          id: `${span.spanId}:result`,
          parentId,
          kind: "tool_result",
          title: `tool result · ${toolName}`,
          content: result,
          toolName,
          startTime,
        })
      );
    }
    // Unknown operations are skipped for now (Phase 0 scope).
  }

  return {
    id: trace.traceId,
    goal: goalText,
    provenance,
    events,
  };
}

function labelFor(kind: EventKind): string {
  switch (kind) {
    case "goal":
      return "goal · user";
    case "plan_step":
      return "plan";
    case "reasoning":
      return "reasoning";
    case "final_answer":
      return "final answer";
    default:
      return kind;
  }
}

function isoFromNano(nano: number): string {
  return new Date(Math.floor(nano / 1e6)).toISOString();
}
