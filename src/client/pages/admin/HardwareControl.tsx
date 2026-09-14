import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  Chip,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  TextField,
  Divider,
} from '@mui/material';
import UsbIcon from '@mui/icons-material/Usb';
import PrintIcon from '@mui/icons-material/Print';
import BarcodeIcon from '@mui/icons-material/QrCodeScanner';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { toast } from 'react-hot-toast';
import { useQuery } from '@tanstack/react-query';
import { initBarcodeScanner, WebUSBPrinter } from '../../utils/hardware.ts';
import { apiClient } from '../../api/client.ts';
import { useAuthStore } from '../../store/auth.ts';

const textFieldStyle = { mt: 1 };

export default function HardwareControl() {
  const { user } = useAuthStore();
  const { data: companySettings } = useQuery({
    queryKey: ['companySettings'],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get('/org/settings');
        return data;
      } catch {
        return null;
      }
    },
  });

  const companyName = companySettings?.name || 'Stockora Enterprise';
  const companyAddress = companySettings?.address || 'Main Location';
  const cashierName = user?.username || 'Active Cashier';

  const [scannedLogs, setScannedLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [printerInstance] = useState(() => new WebUSBPrinter());
  const [testReceiptText, setTestReceiptText] = useState('');

  useEffect(() => {
    queueMicrotask(() => {
      setTestReceiptText(
        '================================\n' +
          `        ${companyName.toUpperCase()} POS       \n` +
          `       ${companyAddress}       \n` +
          `       Operator: ${cashierName}       \n` +
          '================================\n' +
          'ESC/POS Hardware Diagnostic Test\n' +
          'Alignment & Feed Calibration: OK\n' +
          '--------------------------------\n' +
          'Status:                  ONLINE \n' +
          'Diagnostic Check:        PASSED \n' +
          '================================\n' +
          '     Hardware Ready For Use     \n' +
          '================================\n'
      );
    });
  }, [companyName, companyAddress, cashierName]);

  // Bind barcode scanner event listener
  useEffect(() => {
    const removeListener = initBarcodeScanner((sku) => {
      setScannedLogs((prev) =>
        [`[${new Date().toLocaleTimeString()}] SKU Scanned: ${sku}`, ...prev].slice(0, 10)
      );
      toast.success(`Barcode Scanned: "${sku}"`, {
        icon: '🏷️',
      });
    });
    return () => removeListener();
  }, []);

  const handleConnectPrinter = async () => {
    try {
      const connected = await printerInstance.connect();
      if (connected) {
        setIsConnected(true);
        toast.success('WebUSB receipt printer connected successfully!');
      }
    } catch {
      toast.error('Failed to interface printer device. Check connection.');
    }
  };

  const handlePrintTest = async () => {
    try {
      if (!isConnected) {
        // Fallback simulated print under sandbox mode
        toast.success('Simulated Print Job Sent to Virtual Printer Output Console!');
        return;
      }
      await printerInstance.printReceipt(testReceiptText);
      toast.success('Print job completed successfully.');
    } catch {
      toast.error('Print job failed.');
    }
  };

  const handleKickDrawer = async () => {
    try {
      if (!isConnected) {
        toast.success('Simulated Cash Drawer Kick Pulse Triggered!');
        return;
      }
      await printerInstance.triggerCashDrawer();
      toast.success('Pulse signal sent.');
    } catch {
      toast.error('Failed to trigger drawer.');
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Hardware Integration Hub
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure physical POS peripherals, monitor scan inputs buffer, and test printing
          commands.
        </Typography>
      </Box>

      <Grid container spacing={3.5}>
        <Grid item xs={12} md={6}>
          <Paper
            className="glass-panel"
            sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <BarcodeIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Barcode Scanner Telemetry
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                label="Ready to Scan"
                color="success"
                sx={{
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 0.6 },
                    '50%': { opacity: 1 },
                    '100%': { opacity: 0.6 },
                  },
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Connect physical scanner. The background window listener will automatically
                translate inputs.
              </Typography>
            </Box>

            <Divider sx={{ opacity: 0.05 }} />

            <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>
              Scan History Logs (Limit 10)
            </Typography>
            <Box
              sx={{
                flexGrow: 1,
                bgcolor: 'rgba(0,0,0,0.15)',
                borderRadius: 2,
                p: 2,
                minHeight: '200px',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {scannedLogs.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontStyle: 'italic', textAlign: 'center', mt: 8 }}
                >
                  Awaiting scanning events inputs...
                </Typography>
              ) : (
                <List>
                  {scannedLogs.map((log, idx) => (
                    <ListItem key={idx} sx={{ p: 0.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {log}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card className="glass-panel" sx={{ p: 1 }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <UsbIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Thermal Printer Integration
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Button
                  variant="outlined"
                  startIcon={<UsbIcon />}
                  onClick={handleConnectPrinter}
                  disabled={isConnected}
                >
                  {isConnected ? 'USB Connected' : 'Connect WebUSB Printer'}
                </Button>
                <Chip
                  label={isConnected ? 'PRINTER ONLINE' : 'SIMULATION MODE'}
                  color={isConnected ? 'success' : 'warning'}
                  size="small"
                />
              </Box>

              <TextField
                label="ESC/POS Plain Receipt Preview"
                fullWidth
                multiline
                rows={7}
                value={testReceiptText}
                onChange={(e) => setTestReceiptText(e.target.value)}
                sx={textFieldStyle}
                inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
              />

              <Box
                sx={{
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  pt: 2,
                  display: 'flex',
                  gap: 2,
                }}
              >
                <Button
                  variant="contained"
                  startIcon={<PrintIcon />}
                  onClick={handlePrintTest}
                  sx={{ background: 'linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%)' }}
                >
                  Print Test Receipt
                </Button>
                <Button variant="outlined" startIcon={<PlayArrowIcon />} onClick={handleKickDrawer}>
                  Kick Cash Drawer
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
