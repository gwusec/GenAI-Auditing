// AuditorJoin — anonymous auditor entry via an access code.
import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Alert, Paper } from '@mui/material';
import { useFeature0 } from './Feature0Context';

export default function AuditorJoin({ onJoined }) {
  const { joinWithCode } = useFeature0();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

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
    <Paper variant="outlined" sx={{ p: 4, maxWidth: 420, mx: 'auto', mt: 6, borderRadius: 3 }}>
      <Typography variant="h6" gutterBottom>Join a study</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Enter the access code you were given. No account required.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Access code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          fullWidth
          inputProps={{ style: { textTransform: 'uppercase' } }}
        />
        <Button type="submit" variant="contained" disabled={busy || !code.trim()}>Join</Button>
      </Box>
    </Paper>
  );
}
