// AuditorJoin — anonymous auditor entry via an access code.
import React, { useState, useEffect } from 'react';
import { Box, Typography } from '../components/ui/layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert } from '../components/ui/alert';
import { Card } from '../components/ui/card';
import { useFeature0 } from './Feature0Context';

// Read a join-by-link code from the URL: ?code=ABC123 (no router needed).
function codeFromUrl() {
  if (typeof window === 'undefined') return '';
  try {
    const c = new URLSearchParams(window.location.search).get('code');
    return (c || '').trim();
  } catch (_) { return ''; }
}

export default function AuditorJoin({ onJoined }) {
  const { joinWithCode } = useFeature0();
  const [code, setCode] = useState(() => codeFromUrl());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // If arriving via a join link, prefill the code so the auditor only has to confirm.
  useEffect(() => {
    const linked = codeFromUrl();
    if (linked) setCode(linked);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const studyId = await joinWithCode(code.trim());
      if (onJoined) onJoined(studyId);
    } catch (err) {
      setError(err.message || 'Could not join with that code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto mt-12 max-w-[420px] rounded-xl p-8">
      <Typography variant="h6" gutterBottom>Join a study</Typography>
      <Typography variant="body2" color="text.secondary" className="mb-4">
        Enter the access code you were given. No account required.
      </Typography>
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}
      <Box component="form" onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="join-code">Access code</Label>
          <Input
            id="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            className="uppercase"
          />
        </div>
        <Button type="submit" disabled={busy || !code.trim()}>Join</Button>
      </Box>
    </Card>
  );
}
