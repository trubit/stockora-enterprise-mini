import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { api } from '../../api/client.ts';
import { toast } from 'react-hot-toast';

export default function SupplierManager() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    legalName: '',
    code: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    category: 'DISTRIBUTOR',
    paymentTerms: 'NET 30',
    leadTimeDays: 7,
    moq: 1,
  });

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/procurement-advanced/suppliers');
      setSuppliers(res.data || []);
    } catch {
      toast.error('Failed to load suppliers list.');
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleCreateSupplier = async () => {
    try {
      if (!formData.name || !formData.code) {
        toast.error('Supplier name and code are required.');
        return;
      }
      await api.post('/procurement-advanced/suppliers', formData);
      toast.success('Supplier registered successfully!');
      setOpenModal(false);
      setFormData({
        name: '',
        legalName: '',
        code: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        category: 'DISTRIBUTOR',
        paymentTerms: 'NET 30',
        leadTimeDays: 7,
        moq: 1,
      });
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create supplier.');
    }
  };

  return (
    <Box sx={{ p: 3, background: '#0b0f19', minHeight: '100vh', color: '#f8fafc' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <VerifiedUserIcon fontSize="large" /> Supplier Directory & Scorecard Management
          </Typography>
          <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
            Master directory for managing external vendor profiles, multi-contact roles & automated
            performance scorecards
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenModal(true)}
          sx={{
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: '#ffffff',
            fontWeight: 600,
            borderRadius: '9999px',
            px: 3,
            '&:hover': {
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            },
          }}
        >
          Add New Supplier
        </Button>
      </Box>

      <Paper
        sx={{
          p: 3,
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: 3,
          color: '#f8fafc',
        }}
      >
        <TableContainer>
          <Table>
            <TableHead sx={{ background: '#1f2937' }}>
              <TableRow>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Code</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Supplier Name</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Category</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Contact Person</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Lead Time</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Scorecard Rating</TableCell>
                <TableCell sx={{ color: '#9ca3af', fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s._id} sx={{ '&:hover': { background: '#1e293b' } }}>
                  <TableCell sx={{ color: '#818cf8', fontWeight: 700 }}>{s.code}</TableCell>
                  <TableCell sx={{ color: '#f8fafc' }}>
                    {s.name}
                    {s.legalName && (
                      <Typography variant="caption" sx={{ display: 'block', color: '#6b7280' }}>
                        {s.legalName}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={s.category || 'DISTRIBUTOR'}
                      size="small"
                      sx={{ background: '#374151', color: '#cbd5e1' }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#cbd5e1' }}>
                    {s.contactPerson || 'N/A'} {s.email ? `(${s.email})` : ''}
                  </TableCell>
                  <TableCell sx={{ color: '#9ca3af' }}>{s.leadTimeDays || 7} days</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#fbbf24' }}>
                      <StarIcon fontSize="small" />
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                        {s.scorecard?.overallScore || 100}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={s.status || 'ACTIVE'}
                      size="small"
                      sx={{
                        fontWeight: 600,
                        background:
                          (s.status || 'ACTIVE') === 'ACTIVE'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(239, 68, 68, 0.2)',
                        color: (s.status || 'ACTIVE') === 'ACTIVE' ? '#34d399' : '#f87171',
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add Supplier Modal */}
      <Dialog
        open={openModal}
        onClose={() => setOpenModal(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { background: '#111827', color: '#f8fafc', border: '1px solid #1f2937' },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, borderBottom: '1px solid #1f2937' }}>
          Register New Supplier
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Supplier Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Legal Name"
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Supplier Code (e.g. SUP-001)"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Contact Person"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                InputLabelProps={{ shrink: true, style: { color: '#9ca3af' } }}
                InputProps={{ style: { color: '#fff' } }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid #1f2937' }}>
          <Button onClick={() => setOpenModal(false)} sx={{ color: '#9ca3af' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateSupplier}
            sx={{ background: '#8b5cf6', color: '#fff' }}
          >
            Save Supplier
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
