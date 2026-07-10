// ConsentGate — informed-consent screen shown before an auditor reaches the chat
// when the study configures consent text (AUD-3 / PRD §9). The auditor must
// explicitly agree; agreement is recorded on the session as
// { version, agreed: true, timestamp } (see Feature0Context.recordConsent).
//
// Nothing rendered consent before this component existed; a configured consent
// text was silently ignored.

import React, { useState } from 'react';
import { Box, Button, Typography, Paper, Checkbox, FormControlLabel, Stack } from '@mui/material';

export default function ConsentGate({ text, version, onAgree, onDecline, busy = false }) {
  const [checked, setChecked] = useState(false);

  return (
    <Box
      sx={{
        minHeight: '100vh', bgcolor: 'background.default',
        display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
      }}
    >
      <Paper variant="outlined" sx={{ p: 4, maxWidth: 680, width: '100%', borderRadius: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>
          Before you begin
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Please read the following and confirm your consent to participate.
        </Typography>

        <Box
          sx={{
            maxHeight: '48vh', overflowY: 'auto', p: 2, mb: 2,
            bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2,
          }}
        >
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {text}
          </Typography>
        </Box>

        <FormControlLabel
          control={<Checkbox checked={checked} onChange={(e) => setChecked(e.target.checked)} />}
          label="I have read the above and agree to participate."
        />

        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            disabled={!checked || busy}
            onClick={() => onAgree && onAgree(version ?? null)}
          >
            Agree &amp; continue
          </Button>
          {onDecline && (
            <Button variant="text" color="inherit" onClick={onDecline} disabled={busy}>
              Decline
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}
