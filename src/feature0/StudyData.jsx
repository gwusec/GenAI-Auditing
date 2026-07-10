// StudyData — investigator data view for one study (DASH-1/2/3 + export). Reads
// the study's conversations from the configured store (Supabase scopes by study
// via RLS; local returns this browser's conversations), shows summary aggregates
// and a per-conversation list, and downloads tidy/long CSV or JSON built from the
// same projection (src/tools/export).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Container, Typography, Paper, Stack, Alert, Chip, Divider,
  Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Grid,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import { getConversationStore } from '../tools/stores';
import { buildStudyExport, toTidyRows, summarizeRows } from '../tools/export';

function download(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const slug = (s) => (s || 'study').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function StudyData({ study, onBack }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const store = getConversationStore();
      try { store.studyId = study.id; } catch (_) { /* some stores freeze props */ }
      let all = await store.getAllConversations();
      // Best-effort study scoping for stores that don't filter server-side.
      const scoped = all.filter((c) => !c.studyId || c.studyId === study.id);
      setConversations(scoped.length ? scoped : all);
    } catch (err) {
      setError(err.message || 'Could not load conversations for this study.');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [study.id]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => toTidyRows(conversations), [conversations]);
  const summary = useMemo(() => summarizeRows(rows), [rows]);

  const doExport = (kind) => {
    const { csv, json } = buildStudyExport(conversations);
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === 'csv') download(`${slug(study.title)}-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
    else download(`${slug(study.title)}-${stamp}.json`, json, 'application/json');
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={onBack}>Back</Button>
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<RefreshIcon />} onClick={load}>Refresh</Button>
            <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
              onClick={() => doExport('json')} disabled={rows.length === 0}>JSON</Button>
            <Button size="small" variant="contained" startIcon={<DownloadIcon />}
              onClick={() => doExport('csv')} disabled={rows.length === 0}>CSV</Button>
          </Stack>
        </Stack>

        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>{study.title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Collected data — one CSV/JSON row per observation (reaction, highlight, or questionnaire answer),
          each carrying the study-condition provenance.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {[
                ['Conversations', summary.conversationCount],
                ['Observations', summary.observationCount],
                ['Highlights', summary.highlightCount],
                ['Text answers', summary.textResponseCount],
              ].map(([label, n]) => (
                <Grid item xs={6} sm={3} key={label}>
                  <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{n}</Typography>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {Object.keys(summary.reactionCounts).length > 0 && (
              <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Reactions</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {Object.entries(summary.reactionCounts).flatMap(([kind, vals]) =>
                    Object.entries(vals).map(([v, n]) => (
                      <Chip key={`${kind}:${v}`} size="small" label={`${kind} · ${v}: ${n}`} />
                    ))
                  )}
                </Stack>
              </Paper>
            )}

            {Object.keys(summary.likertByQuestion).length > 0 && (
              <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Questionnaire (Likert) distributions</Typography>
                {Object.entries(summary.likertByQuestion).map(([q, dist]) => (
                  <Box key={q} sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{q}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {Object.entries(dist).map(([v, n]) => (
                        <Chip key={v} size="small" variant="outlined" label={`${v}: ${n}`} />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Paper>
            )}

            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>Conversations</Typography>
            {conversations.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2, borderStyle: 'dashed' }}>
                <Typography color="text.secondary">No conversations collected yet.</Typography>
              </Paper>
            ) : (
              <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Conversation</TableCell>
                      <TableCell>Auditor</TableCell>
                      <TableCell>Condition</TableCell>
                      <TableCell align="right">Observations</TableCell>
                      <TableCell>State</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {conversations.map((c) => {
                      const obs = rows.filter((r) => r.conversation_id === c.id).length;
                      return (
                        <TableRow key={c.id} hover>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{String(c.id).slice(0, 8)}</TableCell>
                          <TableCell>{c.userID || c.userId || '—'}</TableCell>
                          <TableCell>{c.provenance?.controlMode || '—'}</TableCell>
                          <TableCell align="right">{obs}</TableCell>
                          <TableCell><Chip size="small" label={c.state || 'unknown'} /></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <Divider />
              </Paper>
            )}
          </>
        )}
      </Container>
    </Box>
  );
}
