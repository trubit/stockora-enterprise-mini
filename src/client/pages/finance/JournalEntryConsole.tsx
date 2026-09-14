import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  IconButton,
  Chip,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import SendIcon from '@mui/icons-material/Send';
import PageHeader from '../../components/PageHeader';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';

export default function JournalEntryConsole() {
  const { formatAmount, currencySymbol } = useRegionalSettings();
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('MANUAL');
  const [lines, setLines] = useState([
    { accountCode: '1000', debit: 500, credit: 0, memo: 'Debit Cash' },
    { accountCode: '4000', debit: 0, credit: 500, memo: 'Credit Sales Revenue' },
  ]);

  const totalDebit = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleAddLine = () => {
    setLines([...lines, { accountCode: '', debit: 0, credit: 0, memo: '' }]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: string, value: any) => {
    const updated = [...lines];
    (updated[idx] as any)[field] = value;
    setLines(updated);
  };

  const handlePostJournal = async () => {
    if (!description) {
      toast.error('Description is required.');
      return;
    }

    if (!isBalanced) {
      toast.error('Unbalanced Journal Entry: Debits must equal Credits.');
      return;
    }

    try {
      await apiClient.post('/accounting/journals', {
        description,
        source,
        lines,
      });
      toast.success('Double-Entry Journal Entry Posted Successfully!');
      setDescription('');
      setLines([
        { accountCode: '1000', debit: 0, credit: 0, memo: '' },
        { accountCode: '4000', debit: 0, credit: 0, memo: '' },
      ]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to post journal entry.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Double-Entry Journal Entry Console"
        subtitle="Post verified accounting journal entries with real-time debit vs credit balance validation"
      />

      <Card sx={{ borderRadius: 2, boxShadow: 2, mb: 3 }}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Journal Description"
              size="small"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
            />
            <TextField
              label="Reference Source"
              size="small"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              sx={{ width: 200 }}
            />
          </Box>

          <Typography variant="h6" sx={{ fontWeight: 'bold', mt: 1 }}>
            Journal Lines
          </Typography>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Account Code</TableCell>
                <TableCell>Debit ({currencySymbol})</TableCell>
                <TableCell>Credit ({currencySymbol})</TableCell>
                <TableCell>Line Memo</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lines.map((line, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <TextField
                      size="small"
                      placeholder="e.g. 1000"
                      value={line.accountCode}
                      onChange={(e) => handleLineChange(idx, 'accountCode', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={line.debit}
                      onChange={(e) => handleLineChange(idx, 'debit', Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="number"
                      size="small"
                      value={line.credit}
                      onChange={(e) => handleLineChange(idx, 'credit', Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={line.memo}
                      onChange={(e) => handleLineChange(idx, 'memo', e.target.value)}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell align="center">
                    <IconButton color="error" onClick={() => handleRemoveLine(idx)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}
          >
            <Button startIcon={<AddIcon />} onClick={handleAddLine}>
              Add Line Item
            </Button>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="subtitle2">
                Total Debits: <strong>{formatAmount(totalDebit)}</strong> | Total Credits:{' '}
                <strong>{formatAmount(totalCredit)}</strong>
              </Typography>
              <Chip
                label={isBalanced ? 'BALANCED' : 'UNBALANCED'}
                color={isBalanced ? 'success' : 'error'}
              />
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                disabled={!isBalanced}
                onClick={handlePostJournal}
              >
                Post Journal
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
