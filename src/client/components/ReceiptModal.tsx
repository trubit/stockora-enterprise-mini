import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Chip,
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import { useRegionalSettings } from '../hooks/useRegionalSettings.js';
import { useTenantStore } from '../store/tenant.ts';
import { useAuthStore } from '../store/auth.ts';

export interface ReceiptItem {
  productName: string;
  name?: string;
  sku: string;
  quantity?: number;
  qty?: number;
  priceTier?: 'RETAIL' | 'WHOLESALE';
  price: number;
  total: number;
}

export interface ReceiptData {
  transactionNumber: string;
  createdAt?: string;
  cashierName?: string;
  branchName?: string;
  customerName?: string;
  customerEmail?: string;
  pricingMode?: 'RETAIL' | 'WHOLESALE' | 'MIXED';
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: string;
  currency?: string;
  // Multi-tenant Seller Identity
  companyName?: string;
  companyLegalName?: string;
  companyLogoUrl?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  companyTaxId?: string;
  receiptHeader?: string;
  receiptFooter?: string;
}

interface ReceiptModalProps {
  open: boolean;
  onClose: () => void;
  receiptData: ReceiptData | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ open, onClose, receiptData }) => {
  const { formatAmount } = useRegionalSettings();
  const { activeTenant } = useTenantStore();
  const { user } = useAuthStore();

  if (!receiptData) return null;

  const receiptCurrency = (receiptData.currency || 'NGN').toUpperCase().trim();

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = receiptData.createdAt
    ? new Date(receiptData.createdAt).toLocaleString()
    : new Date().toLocaleString();

  const displayCompanyName =
    receiptData.companyName ||
    activeTenant?.name ||
    (user as any)?.tenantName ||
    (user as any)?.companyName ||
    user?.branchName ||
    'Store';

  const displayLegalName = receiptData.companyLegalName || activeTenant?.legalName;
  const displayLogoUrl =
    receiptData.companyLogoUrl || activeTenant?.branding?.logoUrl || activeTenant?.logoUrl;
  const sanitizeAddress = (addr?: string): string => {
    if (!addr) return '';
    const trimmed = addr.trim();
    const upper = trimmed.toUpperCase().replace(/[\.,]/g, '');
    if (upper === 'US' || upper === 'USA' || upper === 'UNITED STATES') return '';
    const cleaned = trimmed.replace(/,\s*(US|USA|United States)$/i, '').trim();
    if (!cleaned || cleaned.toUpperCase() === 'US' || cleaned.toUpperCase() === 'USA') return '';
    return cleaned;
  };

  const rawAddress =
    receiptData.companyAddress ||
    (activeTenant?.contact
      ? [
          activeTenant.contact.addressLine1,
          activeTenant.contact.city,
          activeTenant.contact.state,
          activeTenant.contact.country &&
          activeTenant.contact.country.trim().toUpperCase() !== 'US' &&
          activeTenant.contact.country.trim().toUpperCase() !== 'USA'
            ? activeTenant.contact.country.trim()
            : undefined,
        ]
          .filter(Boolean)
          .join(', ')
      : '');
  const displayAddress = sanitizeAddress(rawAddress);
  const displayPhone = receiptData.companyPhone || activeTenant?.contact?.phone;
  const displayEmail = receiptData.companyEmail || activeTenant?.contact?.email;
  const displayHeaderNotice = receiptData.receiptHeader || activeTenant?.branding?.receiptHeader;
  const displayFooterNotice =
    receiptData.receiptFooter ||
    activeTenant?.branding?.receiptFooter ||
    'Thank you for shopping with us! Please keep this receipt.';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          maxWidth: '520px !important',
          width: '100%',
          borderRadius: '20px',
          bgcolor: '#121827',
          color: '#f3f4f6',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
          m: { xs: 1.5, sm: 3 },
        },
      }}
    >
      <DialogTitle
        component="div"
        className="no-print"
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pb: 1,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleOutlineIcon color="success" />
          <Typography variant="h6" component="div" sx={{ fontWeight: 800 }}>
            Sales Receipt & Invoice
          </Typography>
        </Box>
        <Button onClick={onClose} sx={{ minWidth: 'auto', color: 'text.secondary' }}>
          <CloseIcon />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* PRINTABLE RECEIPT CONTAINER */}
        <Box
          id="printable-receipt"
          sx={{
            p: { xs: 2.5, sm: 3 },
            bgcolor: '#ffffff',
            color: '#0f172a',
            borderRadius: '14px',
            fontFamily: 'Inter, monospace, sans-serif',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            maxWidth: '460px',
            mx: 'auto',
          }}
        >
          {/* Print specific CSS */}
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-receipt, #printable-receipt * {
                visibility: visible !important;
              }
              #printable-receipt {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 450px !important;
                margin: 0 auto !important;
                padding: 20px !important;
                background: #ffffff !important;
                color: #000000 !important;
                box-shadow: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          {/* RECEIPT HEADER — AUTHORITATIVE TENANT/COMPANY IDENTITY */}
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            {displayLogoUrl && (
              <Box
                component="img"
                src={displayLogoUrl}
                alt={displayCompanyName}
                sx={{
                  maxHeight: 48,
                  maxWidth: 160,
                  mx: 'auto',
                  mb: 1,
                  display: 'block',
                  objectFit: 'contain',
                }}
              />
            )}
            <Typography
              variant="h5"
              sx={{
                fontWeight: 900,
                letterSpacing: -0.5,
                color: '#0f172a',
                textTransform: 'uppercase',
              }}
            >
              {displayCompanyName}
            </Typography>
            {displayLegalName && displayLegalName !== displayCompanyName && (
              <Typography
                variant="caption"
                sx={{ color: '#64748b', display: 'block', fontWeight: 600 }}
              >
                {displayLegalName}
              </Typography>
            )}
            {displayAddress && (
              <Typography
                variant="caption"
                sx={{ color: '#475569', display: 'block', fontWeight: 500 }}
              >
                {displayAddress}
              </Typography>
            )}
            {(displayPhone || displayEmail) && (
              <Typography
                variant="caption"
                sx={{ color: '#64748b', display: 'block', fontWeight: 500 }}
              >
                {[
                  displayPhone ? `Tel: ${displayPhone}` : '',
                  displayEmail ? `Email: ${displayEmail}` : '',
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </Typography>
            )}
            {displayHeaderNotice && (
              <Typography
                variant="caption"
                sx={{ color: '#334155', display: 'block', fontStyle: 'italic', mt: 0.5 }}
              >
                {displayHeaderNotice}
              </Typography>
            )}
            <Typography
              variant="caption"
              sx={{ color: '#475569', display: 'block', fontWeight: 600, mt: 0.5 }}
            >
              {receiptData.branchName || 'Headquarters Branch'} • POS Sales Terminal
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: '#64748b', display: 'block', fontWeight: 500 }}
            >
              OFFICIAL SALES RECEIPT
            </Typography>
          </Box>

          <Divider sx={{ my: 1.5, borderColor: '#e2e8f0', borderStyle: 'dashed' }} />

          {/* METADATA GRID */}
          <Box sx={{ fontSize: '0.825rem', color: '#1e293b', mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                INVOICE NO:
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}
              >
                {receiptData.transactionNumber}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                DATE & TIME:
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600, color: '#0f172a' }}>
                {formattedDate}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                CASHIER:
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a' }}>
                {receiptData.cashierName || 'Store Cashier'}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 0.5,
              }}
            >
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                PAYMENT METHOD:
              </Typography>
              <Chip
                label={receiptData.paymentMethod}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.675rem',
                  fontWeight: 800,
                  bgcolor: '#f1f5f9',
                  color: '#0f172a',
                }}
              />
            </Box>
            {receiptData.customerName && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  CUSTOMER:
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#0f172a' }}>
                  {receiptData.customerName}
                </Typography>
              </Box>
            )}
            {receiptData.customerEmail && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  CUSTOMER EMAIL:
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600, color: '#0f172a' }}>
                  {receiptData.customerEmail}
                </Typography>
              </Box>
            )}
            {receiptData.pricingMode && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  SALE PRICING TIER:
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    color: receiptData.pricingMode === 'WHOLESALE' ? '#4338ca' : '#0f172a',
                    letterSpacing: '0.04em',
                  }}
                >
                  {receiptData.pricingMode}
                </Typography>
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 1.5, borderColor: '#e2e8f0', borderStyle: 'dashed' }} />

          {/* ITEMS TABLE */}
          <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent', mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#1e293b' }}>
                  <TableCell
                    sx={{
                      color: '#cbd5e1',
                      fontWeight: 700,
                      fontSize: '0.725rem',
                      py: 1,
                      px: 1.5,
                      borderTopLeftRadius: '6px',
                      borderBottomLeftRadius: '6px',
                    }}
                  >
                    ITEM DESCRIPTION
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.725rem', py: 1, px: 1 }}
                  >
                    QTY
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ color: '#cbd5e1', fontWeight: 700, fontSize: '0.725rem', py: 1, px: 1 }}
                  >
                    PRICE
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: '#cbd5e1',
                      fontWeight: 700,
                      fontSize: '0.725rem',
                      py: 1,
                      px: 1.5,
                      borderTopRightRadius: '6px',
                      borderBottomRightRadius: '6px',
                    }}
                  >
                    TOTAL
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {receiptData.items.map((item, index) => (
                  <TableRow key={index} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                    <TableCell sx={{ py: 1.25, px: 1, borderBottom: '1px solid #f1f5f9' }}>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}
                        >
                          {item.productName || item.name}
                        </Typography>
                        {item.priceTier && (
                          <Chip
                            label={item.priceTier}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              bgcolor: item.priceTier === 'WHOLESALE' ? '#e0e7ff' : '#f1f5f9',
                              color: item.priceTier === 'WHOLESALE' ? '#3730a3' : '#475569',
                            }}
                          />
                        )}
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#64748b',
                          fontSize: '0.7rem',
                          display: 'block',
                          fontWeight: 500,
                        }}
                      >
                        SKU: {item.sku}
                      </Typography>
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        py: 1.25,
                        px: 1,
                        borderBottom: '1px solid #f1f5f9',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        color: '#0f172a',
                      }}
                    >
                      {item.quantity ?? item.qty ?? 1}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        py: 1.25,
                        px: 1,
                        borderBottom: '1px solid #f1f5f9',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: '#334155',
                      }}
                    >
                      {formatAmount(item.price, {
                        fromCurrency: (item as any).currency || receiptCurrency,
                        currency: receiptCurrency,
                        convert: false,
                      })}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        py: 1.25,
                        px: 1,
                        borderBottom: '1px solid #f1f5f9',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        color: '#0f172a',
                      }}
                    >
                      {formatAmount(item.total, {
                        fromCurrency: receiptCurrency,
                        currency: receiptCurrency,
                        convert: false,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Divider sx={{ my: 1.5, borderColor: '#e2e8f0', borderStyle: 'dashed' }} />

          {/* FINANCIAL SUMMARY BOX */}
          <Box sx={{ width: '100%', ml: 'auto', fontSize: '0.825rem', color: '#1e293b' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography variant="body2" sx={{ color: '#475569', fontWeight: 500 }}>
                Subtotal
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                {formatAmount(receiptData.subtotal, {
                  fromCurrency: receiptCurrency,
                  currency: receiptCurrency,
                  convert: false,
                })}
              </Typography>
            </Box>
            {receiptData.discount > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  mb: 0.75,
                  color: '#dc2626',
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Discount
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  -
                  {formatAmount(receiptData.discount, {
                    fromCurrency: receiptCurrency,
                    currency: receiptCurrency,
                    convert: false,
                  })}
                </Typography>
              </Box>
            )}
            <Divider sx={{ my: 1.25, borderColor: '#0f172a' }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 900, color: '#0f172a' }}>
                GRAND TOTAL
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 900, color: '#059669' }}>
                {formatAmount(receiptData.total, {
                  fromCurrency: receiptCurrency,
                  currency: receiptCurrency,
                  convert: false,
                })}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2, borderColor: '#e2e8f0', borderStyle: 'dashed' }} />

          {/* RECEIPT FOOTER */}
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, color: '#334155', display: 'block' }}
            >
              {displayFooterNotice}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.675rem' }}>
              Please keep this invoice for warranties & return verification within 14 days.
            </Typography>

            {/* BARCODE GRAPHIC */}
            <Box sx={{ mt: 1.5, opacity: 0.85 }}>
              <Box
                sx={{
                  height: 32,
                  width: '70%',
                  mx: 'auto',
                  background:
                    'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 7px, #fff 7px, #fff 9px)',
                  borderRadius: '2px',
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.675rem',
                  color: '#475569',
                  fontWeight: 600,
                }}
              >
                {receiptData.transactionNumber}
              </Typography>
            </Box>

            {/* PLATFORM BRANDING ATTRIBUTION */}
            <Typography
              variant="caption"
              sx={{
                color: '#94a3b8',
                fontSize: '0.625rem',
                display: 'block',
                mt: 1.5,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Powered by Stockora Enterprise
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions className="no-print" sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          color="inherit"
          sx={{ borderRadius: '8px', fontWeight: 700 }}
        >
          Close
        </Button>
        <Button
          onClick={handlePrint}
          variant="contained"
          color="primary"
          startIcon={<PrintIcon />}
          sx={{ borderRadius: '8px', fontWeight: 800, px: 3 }}
        >
          Print Invoice Receipt
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReceiptModal;
