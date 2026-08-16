import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  FormGroup,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

const OFFICE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

type Player = {
  id: string;
  name: string;
  officeDays: string[];
  seed?: number | null;
};

const PlayersPage = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [name, setName] = useState('');
  const [seed, setSeed] = useState<number | ''>('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDays, setEditingDays] = useState<string[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchPlayers = useCallback(async () => {
    try {
      const response = await fetch('/api/players');
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load players');
      }
      const sorted = (data.players as Player[])
        .map((player) => ({
          ...player,
          officeDays: player.officeDays || [],
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setPlayers(sorted);
    } catch (err: any) {
      setError(err.message || 'Failed to load players');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const toggleDay = (day: string, current: string[], setter: (days: string[]) => void) => {
    setter(current.includes(day) ? current.filter((d) => d !== day) : [...current, day]);
  };

  const handleCreatePlayer = async () => {
    if (!name || selectedDays.length === 0) {
      setError('Please fill in name and select at least one office day.');
      setSuccess('');
      return;
    }

    if (seed !== '' && (seed <= 0 || !Number.isInteger(seed))) {
      setError('Seed must be a positive integer.');
      setSuccess('');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const playerData: { name: string; officeDays: string[]; seed?: number } = {
        name,
        officeDays: selectedDays,
      };
      if (seed !== '') {
        playerData.seed = seed;
      }

      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(playerData),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create player');
      }

      setName('');
      setSeed('');
      setSelectedDays([]);
      setSuccess('Player created successfully!');
      await fetchPlayers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (player: Player) => {
    setEditingId(player.id);
    setEditingDays([...(player.officeDays || [])]);
    setError('');
    setSuccess('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingDays([]);
  };

  const saveOfficeDays = async (playerId: string) => {
    if (editingDays.length === 0) {
      setError('Select at least one office day.');
      setSuccess('');
      return;
    }

    setIsSavingEdit(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officeDays: editingDays }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update player');
      }

      setPlayers((prev) =>
        prev.map((player) =>
          player.id === playerId ? { ...player, officeDays: editingDays } : player
        )
      );
      setEditingId(null);
      setEditingDays([]);
      setSuccess('Office days updated.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setSeed('');
      return;
    }
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setSeed(numValue);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 960, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Players
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          All players
        </Typography>
        {loading ? (
          <Typography color="text.secondary">Loading players…</Typography>
        ) : players.length === 0 ? (
          <Typography color="text.secondary">No players yet. Create one below.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Seed</TableCell>
                <TableCell>Office days</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {players.map((player) => {
                const isEditing = editingId === player.id;
                return (
                  <TableRow key={player.id}>
                    <TableCell>{player.name}</TableCell>
                    <TableCell>{player.seed ?? '—'}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <FormGroup row>
                          {OFFICE_DAYS.map((day) => (
                            <FormControlLabel
                              key={day}
                              control={
                                <Checkbox
                                  size="small"
                                  checked={editingDays.includes(day)}
                                  onChange={() => toggleDay(day, editingDays, setEditingDays)}
                                />
                              }
                              label={day}
                            />
                          ))}
                        </FormGroup>
                      ) : player.officeDays.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          None
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {OFFICE_DAYS.filter((day) => player.officeDays.includes(day)).map((day) => (
                            <Chip key={day} label={day} size="small" />
                          ))}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isEditing ? (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                          <Button size="small" onClick={cancelEdit} disabled={isSavingEdit}>
                            Cancel
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={() => saveOfficeDays(player.id)}
                            disabled={isSavingEdit}
                          >
                            {isSavingEdit ? 'Saving…' : 'Save'}
                          </Button>
                        </Box>
                      ) : (
                        <Button size="small" onClick={() => startEdit(player)} disabled={editingId !== null}>
                          Edit days
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Paper sx={{ p: 3, maxWidth: 480 }}>
        <Typography variant="h6" gutterBottom>
          Create new player
        </Typography>
        <TextField
          label="Player Name"
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Seed (optional)"
          fullWidth
          type="number"
          value={seed}
          onChange={handleSeedChange}
          placeholder="Enter a positive integer"
          helperText="Optional: Tournament seeding number (positive integer)"
          sx={{ mb: 2 }}
        />
        <FormGroup sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Select Office Days:
          </Typography>
          {OFFICE_DAYS.map((day) => (
            <FormControlLabel
              key={day}
              control={
                <Checkbox
                  checked={selectedDays.includes(day)}
                  onChange={() => toggleDay(day, selectedDays, setSelectedDays)}
                />
              }
              label={day}
            />
          ))}
        </FormGroup>
        <Button variant="contained" fullWidth onClick={handleCreatePlayer} disabled={isSubmitting}>
          {isSubmitting ? 'Creating Player...' : 'Create Player'}
        </Button>
      </Paper>
    </Box>
  );
};

export default PlayersPage;
