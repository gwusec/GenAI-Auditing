// summarizeRows — basic investigator-dashboard aggregates (DASH-3) computed from
// the same tidy rows the export uses: conversation/observation counts, turn-
// reaction tallies, Likert distributions per question, and highlight/text counts.
// Pure function over toTidyRows() output.

export function summarizeRows(rows) {
  const conversations = new Set();
  const reactionCounts = {};   // reactionKind -> { value -> n }
  const likertByQuestion = {}; // question_key -> { value -> n }
  let highlightCount = 0;
  let textResponseCount = 0;

  for (const r of rows || []) {
    if (r.conversation_id) conversations.add(r.conversation_id);
    switch (r.observation_type) {
      case 'reaction': {
        const kind = String(r.label || 'reaction');
        const v = String(r.value ?? '');
        reactionCounts[kind] = reactionCounts[kind] || {};
        reactionCounts[kind][v] = (reactionCounts[kind][v] || 0) + 1;
        break;
      }
      case 'likert': {
        const q = String(r.question_key || '');
        const v = String(r.value ?? '');
        likertByQuestion[q] = likertByQuestion[q] || {};
        likertByQuestion[q][v] = (likertByQuestion[q][v] || 0) + 1;
        break;
      }
      case 'highlight':
        highlightCount += 1;
        break;
      case 'text_response':
        textResponseCount += 1;
        break;
      default:
        break;
    }
  }

  return {
    conversationCount: conversations.size,
    observationCount: (rows || []).length,
    reactionCounts,
    likertByQuestion,
    highlightCount,
    textResponseCount,
  };
}

export default summarizeRows;
