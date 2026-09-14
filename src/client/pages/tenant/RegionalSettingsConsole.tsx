import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Button,
  Divider,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CurrencyExchangeIcon from '@mui/icons-material/CurrencyExchange';
import SaveIcon from '@mui/icons-material/Save';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useRegionalSettings } from '../../hooks/useRegionalSettings.js';
import { useTranslation } from '../../hooks/useTranslation.js';
import { apiClient } from '../../api/client.js';
import { SUPPORTED_CURRENCIES } from '../../../shared/currencies.js';
import { SUPPORTED_COUNTRIES, SUPPORTED_TIMEZONES } from '../../../shared/countries.js';
import { SUPPORTED_LANGUAGES } from '../..//i18n/i18n.js';
import { toast } from 'react-hot-toast';

export const RegionalSettingsConsole: React.FC = () => {
  const { t } = useTranslation();
  const { settings, isLoading, updateSettings, isUpdating, formatAmount } = useRegionalSettings();

  // Local Form State
  const [countryCode, setCountryCode] = useState('US');
  const [currency, setCurrency] = useState('USD');
  const [supportedCurrencies, setSupportedCurrencies] = useState<string[]>([
    'USD',
    'NGN',
    'EUR',
    'GBP',
  ]);
  const [timezone, setTimezone] = useState('America/New_York');
  const [language, setLanguage] = useState('en');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h');
  const [firstDayOfWeek, setFirstDayOfWeek] = useState<'Sunday' | 'Monday'>('Monday');
  const [measurementSystem, setMeasurementSystem] = useState<'Metric' | 'Imperial'>('Metric');

  // Exchange Rates & Conversion Tool
  const [ratesData, setRatesData] = useState<Record<string, number>>({});
  const [loadingRates, setLoadingRates] = useState(false);
  const [converterAmount, setConverterAmount] = useState<number>(100);
  const [converterFrom, setConverterFrom] = useState<string>('USD');
  const [converterTo, setConverterTo] = useState<string>('NGN');
  const [convertedResult, setConvertedResult] = useState<number | null>(null);

  // Custom Rate Override Dialog
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState('NGN');
  const [overrideRate, setOverrideRate] = useState(1450);

  useEffect(() => {
    if (settings) {
      setCountryCode(settings.countryCode || 'US');
      setCurrency(settings.currency || 'USD');
      setSupportedCurrencies(settings.supportedCurrencies || ['USD', 'NGN', 'EUR', 'GBP']);
      setTimezone(settings.timezone || 'America/New_York');
      setLanguage(settings.language || 'en');
      setDateFormat(settings.dateFormat || 'YYYY-MM-DD');
      setTimeFormat(settings.timeFormat || '12h');
      setFirstDayOfWeek(settings.firstDayOfWeek || 'Monday');
      setMeasurementSystem(settings.measurementSystem || 'Metric');
    }
  }, [settings]);

  useEffect(() => {
    loadExchangeRates();
  }, [currency]);

  const loadExchangeRates = async () => {
    setLoadingRates(true);
    try {
      const { data } = await apiClient.get<{ rates: Record<string, number> }>(
        `/exchange-rates?base=${currency}`,
        { _skipGlobalErrorToast: true } as any
      );
      setRatesData(data.rates || {});
    } catch {
      // Non-blocking
    } finally {
      setLoadingRates(false);
    }
  };

  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    const country = SUPPORTED_COUNTRIES.find((c) => c.code === newCode);
    if (country) {
      setCurrency(country.defaultCurrency);
      setTimezone(country.defaultTimezone);
    }
  };

  const handleSave = async () => {
    try {
      const selectedCountry = SUPPORTED_COUNTRIES.find((c) => c.code === countryCode);
      await updateSettings({
        country: selectedCountry?.name || 'United States',
        countryCode,
        currency,
        supportedCurrencies,
        timezone,
        language,
        dateFormat,
        timeFormat,
        firstDayOfWeek,
        measurementSystem,
        taxConfig: {
          taxId: '',
          taxRegistrationName: 'Zero-Tax Exempt',
          taxType: 'EXEMPT',
          defaultTaxRate: 0,
          isTaxInclusive: false,
          taxExemptionAllowed: true,
          taxRates: [],
        },
      });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save settings.');
    }
  };

  const handleConvert = async () => {
    try {
      const { data } = await apiClient.post('/exchange-rates/convert', {
        amount: converterAmount,
        fromCurrency: converterFrom,
        toCurrency: converterTo,
      });
      setConvertedResult(data.convertedAmount);
    } catch {
      toast.error('Conversion failed.');
    }
  };

  const handleSaveCustomRate = async () => {
    try {
      await apiClient.post('/exchange-rates/custom', {
        baseCurrency: currency,
        targetCurrency: overrideTarget,
        rate: overrideRate,
      });
      toast.success(`Custom exchange rate for ${overrideTarget} updated.`);
      setOverrideOpen(false);
      loadExchangeRates();
    } catch {
      toast.error('Failed to set custom rate.');
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              color: 'text.primary',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <PublicIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            {t('settings.regionalHeader')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {t('settings.regionalSubtitle')}
          </Typography>
        </Box>

        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={isUpdating}
          sx={{ px: 3, py: 1.2, fontWeight: 700, borderRadius: 2 }}
        >
          {isUpdating ? t('common.saving') : t('common.save')}
        </Button>
      </Box>

      {/* Warning Notice */}
      <Alert severity="info" icon={<WarningAmberIcon />} sx={{ borderRadius: 2 }}>
        {t('settings.saveNotice')}
      </Alert>

      <Grid container spacing={3}>
        {/* 1. Operating Country & Region */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <PublicIcon color="primary" fontSize="small" />
                Operating Country & Regional Standards
              </Typography>
              <Divider />

              <TextField
                select
                label={t('settings.country')}
                value={countryCode}
                onChange={(e) => handleCountryChange(e.target.value)}
                fullWidth
                size="small"
              >
                {SUPPORTED_COUNTRIES.map((c) => (
                  <MenuItem key={c.code} value={c.code}>
                    <span style={{ marginRight: 8 }}>{c.flag}</span>
                    {c.name} ({c.code})
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label={t('settings.timezone')}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                fullWidth
                size="small"
              >
                {SUPPORTED_TIMEZONES.map((tz) => (
                  <MenuItem key={tz} value={tz}>
                    <AccessTimeIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                    {tz}
                  </MenuItem>
                ))}
              </TextField>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    select
                    label={t('settings.defaultLanguage')}
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    fullWidth
                    size="small"
                  >
                    {SUPPORTED_LANGUAGES.map((l) => (
                      <MenuItem key={l.code} value={l.code}>
                        <span style={{ marginRight: 6 }}>{l.flag}</span>
                        {l.nativeName}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    select
                    label={t('settings.timeFormat')}
                    value={timeFormat}
                    onChange={(e) => setTimeFormat(e.target.value as any)}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="12h">12-Hour (AM/PM)</MenuItem>
                    <MenuItem value="24h">24-Hour (Military)</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    select
                    label={t('settings.dateFormat')}
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</MenuItem>
                    <MenuItem value="DD/MM/YYYY">DD/MM/YYYY (UK/EU/NG)</MenuItem>
                    <MenuItem value="MM/DD/YYYY">MM/DD/YYYY (US)</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    select
                    label="Measurement System"
                    value={measurementSystem}
                    onChange={(e) => setMeasurementSystem(e.target.value as any)}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="Metric">Metric (kg, m, L)</MenuItem>
                    <MenuItem value="Imperial">Imperial (lb, ft, gal)</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* 2. Company Base Currency & Multi-Currency */}
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <AttachMoneyIcon color="primary" fontSize="small" />
                Base Currency & Multi-Currency Engine
              </Typography>
              <Divider />

              <TextField
                select
                label={t('settings.baseCurrency')}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                fullWidth
                size="small"
                helperText="Authoritative ledger and reporting currency for all financial records."
              >
                {Object.values(SUPPORTED_CURRENCIES).map((curr) => (
                  <MenuItem key={curr.code} value={curr.code}>
                    <span style={{ marginRight: 8 }}>{curr.flag}</span>
                    <strong>{curr.code}</strong> — {curr.name} ({curr.symbol})
                  </MenuItem>
                ))}
              </TextField>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('settings.supportedCurrencies')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {Object.values(SUPPORTED_CURRENCIES).map((curr) => {
                    const isSelected = supportedCurrencies.includes(curr.code);
                    return (
                      <Chip
                        key={curr.code}
                        label={`${curr.flag} ${curr.code} (${curr.symbol})`}
                        clickable
                        color={isSelected ? 'primary' : 'default'}
                        variant={isSelected ? 'filled' : 'outlined'}
                        onClick={() => {
                          if (curr.code === currency) return; // Cannot deselect base
                          if (isSelected) {
                            setSupportedCurrencies(
                              supportedCurrencies.filter((c) => c !== curr.code)
                            );
                          } else {
                            setSupportedCurrencies([...supportedCurrencies, curr.code]);
                          }
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>

              <Box
                sx={{
                  p: 2,
                  bgcolor: 'rgba(99, 102, 241, 0.08)',
                  borderRadius: 2,
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                }}
              >
                <Typography variant="body2" sx={{ color: 'primary.light', fontWeight: 600 }}>
                  Active Base Format Preview:
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: 'text.primary' }}>
                  {formatAmount(1425000.5)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* 3. Live Exchange Rates & Converter Tool */}
        <Grid item xs={12}>
          <Card
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 3,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <CurrencyExchangeIcon color="primary" fontSize="small" />
                  Live Rates & Conversion
                </Typography>
                <Button size="small" variant="text" onClick={() => setOverrideOpen(true)}>
                  Custom Overrides
                </Button>
              </Box>
              <Divider />

              {/* Converter Widget */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'rgba(255,255,255,0.03)',
                  borderRadius: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Interactive Currency Converter
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={4}>
                    <TextField
                      label="Amount"
                      type="number"
                      size="small"
                      value={converterAmount}
                      onChange={(e) => setConverterAmount(Number(e.target.value))}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      select
                      label="From"
                      size="small"
                      value={converterFrom}
                      onChange={(e) => setConverterFrom(e.target.value)}
                      fullWidth
                    >
                      {Object.keys(SUPPORTED_CURRENCIES).map((c) => (
                        <MenuItem key={c} value={c}>
                          {c}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      select
                      label="To"
                      size="small"
                      value={converterTo}
                      onChange={(e) => setConverterTo(e.target.value)}
                      fullWidth
                    >
                      {Object.keys(SUPPORTED_CURRENCIES).map((c) => (
                        <MenuItem key={c} value={c}>
                          {c}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </Grid>

                <Button
                  variant="contained"
                  size="small"
                  onClick={handleConvert}
                  fullWidth
                  sx={{ mt: 0.5 }}
                >
                  Calculate Conversion
                </Button>

                {convertedResult !== null && (
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: 'rgba(52, 211, 153, 0.1)',
                      borderRadius: 1.5,
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {converterAmount} {converterFrom} equals
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#34d399' }}>
                      {formatAmount(convertedResult, converterTo)}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Rates Snapshot Table */}
              <Box>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  Current Benchmark Rates relative to 1 {currency}:
                </Typography>
                {loadingRates ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : (
                  <TableContainer
                    component={Paper}
                    sx={{ maxHeight: 180, bgcolor: 'transparent', mt: 1 }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, bgcolor: 'background.paper' }}>
                            Target Currency
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ fontWeight: 700, bgcolor: 'background.paper' }}
                          >
                            Rate
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(ratesData).map(([currCode, rateVal]) => (
                          <TableRow key={currCode}>
                            <TableCell>
                              <span style={{ marginRight: 6 }}>
                                {SUPPORTED_CURRENCIES[currCode]?.flag || '🌐'}
                              </span>
                              <strong>{currCode}</strong>
                            </TableCell>
                            <TableCell align="right">
                              {Number(rateVal).toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Custom Exchange Rate Dialog */}
      <Dialog open={overrideOpen} onClose={() => setOverrideOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Set Tenant Exchange Rate Override</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Base Currency" value={currency} disabled fullWidth size="small" />
          <TextField
            select
            label="Target Currency"
            value={overrideTarget}
            onChange={(e) => setOverrideTarget(e.target.value)}
            fullWidth
            size="small"
          >
            {Object.keys(SUPPORTED_CURRENCIES).map((c) => (
              <MenuItem key={c} value={c}>
                {c}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Internal Fixed Rate"
            type="number"
            value={overrideRate}
            onChange={(e) => setOverrideRate(Number(e.target.value))}
            fullWidth
            size="small"
            helperText={`1 ${currency} = ${overrideRate} ${overrideTarget}`}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOverrideOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveCustomRate}>
            Save Rate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
export default RegionalSettingsConsole;
