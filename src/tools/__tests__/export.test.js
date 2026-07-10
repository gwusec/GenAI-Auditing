// Export projector tests (§4.2): tidy/long projection, provenance on every row,
// and CSV⇄JSON agreement (the CSV must decode back to exactly the JSON cells,
// including free-text with commas, quotes, and embedded newlines).

import { describe, test, expect } from 'vitest';
import { toTidyRows, TIDY_COLUMNS } from '../export/toTidyRows';
import { toCsv, parseCsv } from '../export/toCsv';
import { buildStudyExport, summarizeRows } from '../export';
import { CHAT_EVENT_TYPE } from '../models';

// A fixture conversation touching all four observation types, with adversarial
// text in a free-text answer and a highlight explanation.
const fixtureConversation = () => ({
  id: 'conv-1',
  userID: 'auditor-7',
  studyId: 'study-42',
  startTimestamp: 1000,
  endTimestamp: 2000,
  provenance: {
    controlMode: 'seed_prompt',
    seedOrFirstTurnText: 'You are a hiring manager, screening "top" talent.',
    modelConfigId: 'openai:gpt-4o',
    modelConfigVersion: 3,
    configVersion: 3,
  },
  chatEvents: [
    { id: 'e1', type: CHAT_EVENT_TYPE.NEW_REACTION, timestamp: 1500, data: { messageId: 'm1', type: 'flag', value: 'biased', comment: 'unfair, and\nmultiline' } },
    { id: 'e2', type: CHAT_EVENT_TYPE.NEW_REACTION, timestamp: 1600, data: { messageId: 'm2', type: 'thumbs', value: 'down' } },
  ],
  audit: {
    likertResponses: { problematic: 'Strongly agree', biased: 'Agree' },
    textResponses: { explain: 'It said "X, Y, Z"\nand that is a problem.' },
    highlights: [
      { messageId: 'm1', quotedText: 'top talent', startOffset: 4, endOffset: 14, label: 'bias', explanation: 'coded language' },
    ],
  },
});

describe('toTidyRows', () => {
  test('emits one row per observation, filled to the full column set', () => {
    const rows = toTidyRows([fixtureConversation()]);
    // 2 reactions + 1 highlight + 2 likert + 1 text = 6
    expect(rows).toHaveLength(6);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([...TIDY_COLUMNS].sort());
    }
    const kinds = rows.map((r) => r.observation_type).sort();
    expect(kinds).toEqual(['highlight', 'likert', 'likert', 'reaction', 'reaction', 'text_response']);
  });

  test('every row carries the conversation provenance columns', () => {
    const rows = toTidyRows([fixtureConversation()]);
    for (const row of rows) {
      expect(row.conversation_id).toBe('conv-1');
      expect(row.study_id).toBe('study-42');
      expect(row.control_mode).toBe('seed_prompt');
      expect(row.model_config_id).toBe('openai:gpt-4o');
      expect(row.config_version).toBe(3);
    }
  });

  test('tolerates legacy highlight shape ({text,startIndex})', () => {
    const conv = fixtureConversation();
    conv.audit.highlights = [{ messageId: 'm9', text: 'legacy', startIndex: 2 }];
    const [hl] = toTidyRows([conv]).filter((r) => r.observation_type === 'highlight');
    expect(hl.quoted_text).toBe('legacy');
    expect(hl.start_offset).toBe(2);
  });

  test('empty / missing collections produce no rows and never throw', () => {
    expect(toTidyRows([])).toEqual([]);
    expect(toTidyRows([{ id: 'x' }])).toEqual([]);
    expect(toTidyRows(undefined)).toEqual([]);
  });

  test('flattens the AuditFlow questionnaire shape (audit.questionnaire)', () => {
    // Matches how AuditFlow persists SurveyJS responses: a flat map where a matrix
    // answer is an object, a rating is a number, and free text is a string.
    const conv = {
      id: 'c2',
      provenance: { controlMode: 'seed_prompt', configVersion: 1 },
      audit: {
        questionnaire: {
          fairness_matrix: { unfair: 2, disrespectful: 1, inaccurate: 3 },
          overall_fairness: 2,
          fairness_explain: 'The pirate persona is odd, "unprofessional", and biased.',
        },
      },
    };
    const rows = toTidyRows([conv]);
    // 3 matrix sub-rows + 1 rating + 1 text = 5
    expect(rows).toHaveLength(5);

    const matrix = rows.filter((r) => r.question_key.startsWith('fairness_matrix.'));
    expect(matrix.map((r) => r.question_key).sort())
      .toEqual(['fairness_matrix.disrespectful', 'fairness_matrix.inaccurate', 'fairness_matrix.unfair']);
    expect(matrix.every((r) => r.observation_type === 'likert')).toBe(true);

    const rating = rows.find((r) => r.question_key === 'overall_fairness');
    expect(rating).toMatchObject({ observation_type: 'likert', value: 2 });

    const text = rows.find((r) => r.question_key === 'fairness_explain');
    expect(text.observation_type).toBe('text_response');
    // provenance still rides along
    expect(text.control_mode).toBe('seed_prompt');
  });
});

describe('CSV ⇄ JSON agreement', () => {
  test('parseCsv(toCsv(rows)) equals the rows coerced to strings', () => {
    const rows = toTidyRows([fixtureConversation()]);
    const decoded = parseCsv(toCsv(rows));
    expect(decoded).toHaveLength(rows.length);
    decoded.forEach((decodedRow, i) => {
      for (const col of TIDY_COLUMNS) {
        expect(decodedRow[col]).toBe(String(rows[i][col]));
      }
    });
  });

  test('buildStudyExport gives CSV and JSON derived from the same rows', () => {
    const { rows, csv, json } = buildStudyExport([fixtureConversation()]);
    expect(JSON.parse(json)).toEqual(rows);
    const header = csv.split('\n')[0];
    expect(header).toBe(TIDY_COLUMNS.join(','));
    // multi-line free text stays inside one quoted field -> row count is stable
    expect(parseCsv(csv)).toHaveLength(rows.length);
  });

  test('fields with commas, quotes, and newlines survive the round trip', () => {
    const rows = toTidyRows([fixtureConversation()]);
    const textRow = rows.find((r) => r.observation_type === 'text_response');
    expect(textRow.value).toContain('\n');
    const decoded = parseCsv(toCsv(rows)).find((r) => r.observation_type === 'text_response');
    expect(decoded.value).toBe(textRow.value);
  });
});

describe('summarizeRows', () => {
  test('aggregates conversation count, reactions, and Likert distributions', () => {
    const rows = toTidyRows([fixtureConversation()]);
    const s = summarizeRows(rows);
    expect(s.conversationCount).toBe(1);
    expect(s.observationCount).toBe(6);
    expect(s.reactionCounts.flag).toEqual({ biased: 1 });
    expect(s.reactionCounts.thumbs).toEqual({ down: 1 });
    expect(s.likertByQuestion.problematic).toEqual({ 'Strongly agree': 1 });
    expect(s.highlightCount).toBe(1);
    expect(s.textResponseCount).toBe(1);
  });

  test('is safe on empty input', () => {
    expect(summarizeRows([]).conversationCount).toBe(0);
    expect(summarizeRows(undefined).observationCount).toBe(0);
  });
});
