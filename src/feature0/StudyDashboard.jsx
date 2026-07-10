// StudyDashboard — investigator home. Lists studies as cards, creates new ones,
// and navigates into StudySetup for configuration. Also lets an investigator
// take/preview studies they're an auditor on.

import React, { useCallback, useEffect, useState } from 'react';
import {
  AppBar, Toolbar, Typography, Box, Container, Button, TextField, Card, CardContent,
  CardActions, Grid, Chip, Stack, Alert, Paper, Avatar, Divider, IconButton, Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BarChartIcon from '@mui/icons-material/BarChart';
import ScienceIcon from '@mui/icons-material/Science';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import { useFeature0 } from './Feature0Context';
import StudySetup from './StudySetup';
import StudyData from './StudyData';
import { validateStudyConfig, withStudyConfigDefaults } from '../tools/studyConfig';
import { useColorMode } from '../theme';

export default function StudyDashboard() {
  const { user, studies, signOut, previewStudy } = useFeature0();
  const { mode, toggle: toggleColorMode } = useColorMode();
  const [list, setList] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null); // study being configured
  const [viewingData, setViewingData] = useState(null); // study whose data is being viewed

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setList(await studies.listStudiesForUser(user.id));
    } catch (err) {
      setError(err.message);
    }
  }, [studies, user]);

  useEffect(() => { refresh(); }, [refresh]);

  const createStudy = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const study = await studies.createStudy(user.id, { title: title.trim() });
      setTitle('');
      await refresh();
      setSelected(study); // jump straight into setup
    } catch (err) {
      setError(err.message);
    }
  };

  if (selected) {
    return <StudySetup study={selected} onBack={() => { setSelected(null); refresh(); }} />;
  }

  if (viewingData) {
    return <StudyData study={viewingData} onBack={() => setViewingData(null)} />;
  }

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <AppBar position="sticky">
        <Toolbar>
          <ScienceIcon sx={{ mr: 1.5, color: 'primary.main' }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: '-0.01em' }}>TRAILS</Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Tooltip title={mode === 'dark' ? 'Light mode' : 'Dark mode'}>
              <IconButton color="inherit" size="small" onClick={toggleColorMode}>
                {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Avatar sx={{ width: 30, height: 30, bgcolor: 'primary.dark', fontSize: 14 }}>
              {(user?.email || user?.displayName || '?').charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>{user?.email || user?.displayName}</Typography>
            <Button color="inherit" size="small" onClick={signOut}>Sign out</Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 4, borderRadius: 2, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>Create a new study</Typography>
          <Box component="form" onSubmit={createStudy} sx={{ display: 'flex', gap: 2 }}>
            <TextField
              placeholder="e.g. Fairness audit — customer support bot"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth size="small"
            />
            <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={!title.trim()} sx={{ whiteSpace: 'nowrap' }}>
              Create &amp; set up
            </Button>
          </Box>
        </Paper>

        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Your studies</Typography>

        {list.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 2, borderStyle: 'dashed' }}>
            <ScienceIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">No studies yet. Create your first one above.</Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {list.map((s) => {
              const isInvestigator = s.roles.includes('investigator');
              // A study is "ready" to run/preview when its config is valid (model set).
              // The questionnaire is optional (SC-6), so don't gate on it.
              const configured = validateStudyConfig(withStudyConfigDefaults(s.config || {})).valid;
              return (
                <Grid item xs={12} sm={6} key={s.id}>
                  <Card variant="outlined" sx={{ borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        {s.roles.map((r) => (
                          <Chip key={r} label={r} size="small"
                            color={r === 'investigator' ? 'primary' : 'default'} variant="outlined" />
                        ))}
                        {isInvestigator && (
                          <Chip
                            label={configured ? 'Ready' : 'Needs setup'}
                            size="small"
                            color={configured ? 'success' : 'warning'}
                          />
                        )}
                      </Stack>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>{s.title}</Typography>
                      {s.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{s.description}</Typography>
                      )}
                    </CardContent>
                    <Divider />
                    <CardActions sx={{ px: 2, py: 1.5 }}>
                      {isInvestigator && (
                        <Button size="small" startIcon={<SettingsIcon />} onClick={() => setSelected(s)}>
                          Set up
                        </Button>
                      )}
                      {isInvestigator && (
                        <Button size="small" startIcon={<BarChartIcon />} onClick={() => setViewingData(s)}>
                          Data
                        </Button>
                      )}
                      <Button
                        size="small" startIcon={<PlayArrowIcon />}
                        onClick={() => previewStudy(s)}
                        disabled={isInvestigator && !configured}
                      >
                        {isInvestigator ? 'Preview' : 'Take study'}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
