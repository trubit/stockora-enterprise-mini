import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert,
  AlertTitle,
  Chip,
  Stack,
  Divider,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockIcon from '@mui/icons-material/Block';
import PageHeader from '../../components/PageHeader';

export default function TaxManagementConsole() {
  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <PageHeader
        title="Taxation & Fiscal Policy"
        subtitle="Authoritative zero-tax and direct-net pricing governance"
      />

      <Alert severity="info" sx={{ borderRadius: 2 }}>
        <AlertTitle sx={{ fontWeight: 700 }}>Zero-Tax Architecture Policy Active</AlertTitle>
        Stockora Enterprise Mini strictly operates under a 100% direct-net pricing model. Sales tax,
        VAT, GST, and tax surcharges are permanently disabled across all transactions, POS
        terminals, invoices, and product catalogs.
      </Alert>

      <Card sx={{ borderRadius: 3, border: '1px solid rgba(255,255,255,0.06)' }}>
        <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <CheckCircleOutlineIcon color="success" />
            Active Tax Rule Enforcement
          </Typography>
          <Divider />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
            <Card variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                GLOBAL TAX RATE
              </Typography>
              <Typography variant="h4" fontWeight={800} color="primary.main" sx={{ my: 0.5 }}>
                0.00%
              </Typography>
              <Chip label="Permanent Zero-Tax" size="small" color="success" variant="outlined" />
            </Card>

            <Card variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                PRICING MODEL
              </Typography>
              <Typography variant="h5" fontWeight={800} sx={{ my: 0.8 }}>
                Pure Net Pricing
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Line Total = Qty &times; Unit Price (No Tax Layer)
              </Typography>
            </Card>

            <Card variant="outlined" sx={{ flex: 1, p: 2, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                SURCHARGE STATUS
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.8 }}>
                <BlockIcon color="error" fontSize="small" />
                <Typography variant="h6" fontWeight={800} color="error.main">
                  Deactivated
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                All tax surcharge calculations blocked
              </Typography>
            </Card>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
