// ConsentGate — informed-consent screen shown before an auditor reaches the chat
// when the study configures consent text (AUD-3 / PRD §9). The auditor must
// explicitly agree; agreement is recorded on the session as
// { version, agreed: true, timestamp } (see Feature0Context.recordConsent).
//
// Nothing rendered consent before this component existed; a configured consent
// text was silently ignored.

import React, { useState } from 'react';
import { Box, Typography, Stack } from '../components/ui/layout';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';

export default function ConsentGate({ text, version, onAgree, onDecline, busy = false }) {
  const [checked, setChecked] = useState(false);

  return (
    <Box className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-[680px] rounded-xl p-8">
        <Typography variant="h5" gutterBottom className="font-bold">
          Before you begin
        </Typography>
        <Typography variant="body2" color="text.secondary" className="mb-4">
          Please read the following and confirm your consent to participate.
        </Typography>

        <Box className="mb-4 max-h-[48vh] overflow-y-auto rounded-md border bg-card p-4">
          <Typography variant="body1" className="whitespace-pre-wrap">
            {text}
          </Typography>
        </Box>

        <label className="flex items-center gap-2">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
          <span className="text-sm">I have read the above and agree to participate.</span>
        </label>

        <Stack direction="row" spacing={2} className="mt-4">
          <Button
            disabled={!checked || busy}
            onClick={() => onAgree && onAgree(version ?? null)}
          >
            Agree &amp; continue
          </Button>
          {onDecline && (
            <Button variant="ghost" onClick={onDecline} disabled={busy}>
              Decline
            </Button>
          )}
        </Stack>
      </Card>
    </Box>
  );
}
