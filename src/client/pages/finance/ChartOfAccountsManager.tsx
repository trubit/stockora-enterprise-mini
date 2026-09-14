import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PageHeader from '../../components/PageHeader';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';

export default function ChartOfAccountsManager() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('ASSET');
  const [description, setDescription] = useState('');

  const fetchAccounts = async () => {
    try {
      const res = await apiClient.get('/finance/accounts');
      const resData = res.data?.data;
      const list = Array.isArray(resData) ? resData : Array.isArray(res.data) ? res.data : [];
      setAccounts(list);
    } catch {
      toast.error('Failed to load Chart of Accounts.');
      setAccounts([]);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreateAccount = async () => {
    if (!code || !name) {
      toast.error('Account Code and Name are required.');
      return;
    }

    try {
      await apiClient.post('/finance/accounts', { code, name, type, description });
      toast.success('Account Created Successfully!');
      setModalOpen(false);
      setCode('');
      setName('');
      setDescription('');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create account.');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Chart of Accounts (COA)"
        subtitle="Manage enterprise accounts hierarchy, category types & general ledger codes"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setModalOpen(true)}>
            Add Account Code
          </Button>
        }
      />

      <Card sx={{ borderRadius: 2, boxShadow: 2 }}>
        <CardContent>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Account Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Current Balance</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a._id}>
                  <TableCell sx={{ fontWeight: 'bold' }}>{a.code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={a.type}
                      size="small"
                      color={
                        a.type === 'ASSET'
                          ? 'primary'
                          : a.type === 'REVENUE'
                            ? 'success'
                            : a.type === 'EXPENSE' || a.type === 'COGS'
                              ? 'warning'
                              : 'secondary'
                      }
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>
                    ${(a.currentBalance || 0).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={a.isActive ? 'Active' : 'Inactive'}
                      color={a.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Create New Account</DialogTitle>
        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Account Code (e.g. 1050)"
            size="small"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            fullWidth
          />
          <TextField
            label="Account Name"
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <TextField
            select
            label="Account Type"
            size="small"
            value={type}
            onChange={(e) => setType(e.target.value)}
            fullWidth
          >
            <MenuItem value="ASSET">ASSET</MenuItem>
            <MenuItem value="LIABILITY">LIABILITY</MenuItem>
            <MenuItem value="EQUITY">EQUITY</MenuItem>
            <MenuItem value="REVENUE">REVENUE</MenuItem>
            <MenuItem value="COGS">COGS</MenuItem>
            <MenuItem value="EXPENSE">EXPENSE</MenuItem>
          </TextField>
          <TextField
            label="Description"
            size="small"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateAccount}>
            Save Account
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
