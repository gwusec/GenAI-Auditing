// StudyData — investigator data view for one study (DASH-1/2/3 + export). Reads
// the study's conversations from the configured store (Supabase scopes by study
// via RLS; local returns this browser's conversations), shows summary aggregates
// and a per-conversation list, and downloads tidy/long CSV or JSON built from the
// same projection (src/tools/export).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Typography, Stack, Divider, Grid } from '../components/ui/layout';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/table';
import { Spinner } from '../components/ui/spinner';
import {
  ArrowBack as ArrowBackIcon, Download as DownloadIcon, Refresh as RefreshIcon, Close,
} from '../components/ui/icons';
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
    <Box className="min-h-screen bg-background">
      <Box className="mx-auto max-w-[900px] px-6 py-8">
        <Stack direction="row" alignItems="center" justifyContent="space-between" className="mb-4">
          <Button variant="ghost" onClick={onBack}><ArrowBackIcon />Back</Button>
          <Stack direction="row" spacing={1}>
            <Button variant="ghost" size="sm" onClick={load}><RefreshIcon />Refresh</Button>
            <Button size="sm" variant="outline"
              onClick={() => doExport('json')} disabled={rows.length === 0}><DownloadIcon />JSON</Button>
            <Button size="sm"
              onClick={() => doExport('csv')} disabled={rows.length === 0}><DownloadIcon />CSV</Button>
          </Stack>
        </Stack>

        <Typography variant="h5" className="mb-1 font-bold">{study.title}</Typography>
        <Typography variant="body2" color="text.secondary" className="mb-6">
          Collected data — one CSV/JSON row per observation (reaction, highlight, or questionnaire answer),
          each carrying the study-condition provenance.
        </Typography>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <div className="flex items-start justify-between gap-2">
              <AlertDescription>{error}</AlertDescription>
              <Button variant="ghost" size="icon" className="-mr-1 -mt-1 h-6 w-6 shrink-0" onClick={() => setError(null)}>
                <Close />
              </Button>
            </div>
          </Alert>
        )}

        {loading ? (
          <Box className="flex justify-center py-12"><Spinner size={40} /></Box>
        ) : (
          <>
            <Grid container spacing={2} className="mb-6">
              {[
                ['Conversations', summary.conversationCount],
                ['Observations', summary.observationCount],
                ['Highlights', summary.highlightCount],
                ['Text answers', summary.textResponseCount],
              ].map(([label, n]) => (
                <Grid item xs={6} sm={3} key={label}>
                  <Card className="p-4 text-center">
                    <Typography variant="h4" className="font-bold">{n}</Typography>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {Object.keys(summary.reactionCounts).length > 0 && (
              <Card className="mb-6 p-4">
                <Typography variant="subtitle2" className="mb-2">Reactions</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {Object.entries(summary.reactionCounts).flatMap(([kind, vals]) =>
                    Object.entries(vals).map(([v, n]) => (
                      <Badge key={`${kind}:${v}`} variant="secondary">{`${kind} · ${v}: ${n}`}</Badge>
                    ))
                  )}
                </Stack>
              </Card>
            )}

            {Object.keys(summary.likertByQuestion).length > 0 && (
              <Card className="mb-6 p-4">
                <Typography variant="subtitle2" className="mb-2">Questionnaire (Likert) distributions</Typography>
                {Object.entries(summary.likertByQuestion).map(([q, dist]) => (
                  <Box key={q} className="mb-2">
                    <Typography variant="body2" className="font-semibold">{q}</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {Object.entries(dist).map(([v, n]) => (
                        <Badge key={v} variant="outline">{`${v}: ${n}`}</Badge>
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Card>
            )}

            <Typography variant="subtitle1" className="mb-2 font-semibold">Conversations</Typography>
            {conversations.length === 0 ? (
              <Card className="border-dashed p-8 text-center">
                <Typography color="text.secondary">No conversations collected yet.</Typography>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conversation</TableHead>
                      <TableHead>Auditor</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead className="text-right">Observations</TableHead>
                      <TableHead>State</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversations.map((c) => {
                      const obs = rows.filter((r) => r.conversation_id === c.id).length;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs">{String(c.id).slice(0, 8)}</TableCell>
                          <TableCell>{c.userID || c.userId || '—'}</TableCell>
                          <TableCell>{c.provenance?.controlMode || '—'}</TableCell>
                          <TableCell className="text-right">{obs}</TableCell>
                          <TableCell><Badge variant="secondary">{c.state || 'unknown'}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <Divider />
              </Card>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
