// InvestigatorAuth — login / sign-up form for investigators.
import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Tabs, Tab, Alert, Paper } from '@mui/material';
import { useFeature0 } from './Feature0Context';

export default function InvestigatorAuth() {
  const { signIn, signUp } = useFeature0();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      if (mode === 'signin') await signIn({ email, password });
      else await signUp({ email, password, displayName });
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 4, maxWidth: 420, mx: 'auto', mt: 6, borderRadius: 3 }}>
      <Typography variant="h6" gutterBottom>Investigator access</Typography>
      <Tabs value={mode} onChange={(_, v) => setMode(v)} sx={{ mb: 2 }}>
        <Tab label="Sign in" value="signin" />
        <Tab label="Create account" value="signup" />
      </Tabs>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box component="form" onSubmit={submit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {mode === 'signup' && (
          <TextField label="Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} fullWidth />
        )}
        <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
        <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
        <Button type="submit" variant="contained" disabled={busy}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </Box>
    </Paper>
  );
}
