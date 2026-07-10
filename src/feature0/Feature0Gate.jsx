// Feature0Gate — landing screen: try the demo, join with a code, or sign in as
// an investigator.
import React, { useState } from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography, Button, Stack, Divider, IconButton, Tooltip } from '@mui/material';
import ScienceIcon from '@mui/icons-material/Science';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import InvestigatorAuth from './InvestigatorAuth';
import AuditorJoin from './AuditorJoin';
import { useFeature0 } from './Feature0Context';
import { useColorMode } from '../theme';

export default function Feature0Gate() {
  const { startDemo } = useFeature0();
  const { mode, toggle: toggleColorMode } = useColorMode();
  const [role, setRole] = useState('auditor');

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pt: { xs: 4, sm: 8 }, px: 2, position: 'relative' }}>
      <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
        <IconButton onClick={toggleColorMode} sx={{ position: 'absolute', top: 16, right: 16 }}>
          {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Stack alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <ScienceIcon color="primary" sx={{ fontSize: 44 }} />
        <Typography variant="h4" align="center" sx={{ fontWeight: 700 }}>TRAILS Chatbot Audit</Typography>
        <Typography variant="body1" color="text.secondary" align="center" sx={{ maxWidth: 480 }}>
          Help evaluate AI chatbot responses for fairness, bias, and harm.
        </Typography>
      </Stack>

      {/* Demo CTA */}
      <Box sx={{ maxWidth: 420, mx: 'auto', mb: 3 }}>
        <Button
          fullWidth size="large" variant="contained" startIcon={<PlayCircleIcon />}
          onClick={startDemo} sx={{ py: 1.4, borderRadius: 2 }}
        >
          Try the demo — no sign-up
        </Button>
        <Divider sx={{ my: 2 }}>or</Divider>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
        <ToggleButtonGroup value={role} exclusive onChange={(_, v) => v && setRole(v)} size="small">
          <ToggleButton value="auditor">I have an access code</ToggleButton>
          <ToggleButton value="investigator">I'm an investigator</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {role === 'auditor' ? <AuditorJoin /> : <InvestigatorAuth />}
    </Box>
  );
}
