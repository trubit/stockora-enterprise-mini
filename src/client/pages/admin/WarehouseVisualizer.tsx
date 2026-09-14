import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client.ts';
import {
  Box,
  Typography,
  Paper,
  Grid,
  MenuItem,
  TextField,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import InfoIcon from '@mui/icons-material/Info';

interface WarehouseData {
  _id: string;
  name: string;
  code: string;
  capacity?: number;
  rowsCount?: number;
  shelvesCount?: number;
  binsCount?: number;
}

const textFieldStyle = { mt: 1 };

export default function WarehouseVisualizer() {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [activeSlot, setActiveSlot] = useState<{ row: number; shelf: number; bin: number } | null>(
    null
  );

  const { data: warehouses = [] } = useQuery<WarehouseData[]>({
    queryKey: ['warehouses-visualizer'],
    queryFn: async () => {
      const { data } = await apiClient.get('/org/warehouses');
      if (data.length > 0 && !selectedWarehouseId) {
        setSelectedWarehouseId(data[0]._id);
      }
      return data;
    },
  });

  const selectedWarehouse = warehouses.find((w) => w._id === selectedWarehouseId);

  // Generate simulated products stored inside slots
  const getProductAtSlot = (row: number, shelf: number, bin: number) => {
    // Deterministic simulation based on index values
    const hash = (row * 7 + shelf * 13 + bin * 19) % 5;
    if (hash === 0) return { name: 'Wireless Ergonomic Mouse', sku: 'MS-ERG-09', qty: 45 };
    if (hash === 1) return { name: 'Mechanical Keyboard RED', sku: 'KB-MCH-88', qty: 12 };
    if (hash === 2) return { name: 'UltraWide Curved Monitor 34"', sku: 'MN-CRV-34', qty: 8 };
    return null; // Empty slot
  };

  const getCapacityColor = (row: number, shelf: number, bin: number) => {
    const prod = getProductAtSlot(row, shelf, bin);
    if (!prod) return 'rgba(255, 255, 255, 0.04)'; // Empty
    if (prod.qty > 30) return '#ef4444'; // Hot / Near Full capacity
    if (prod.qty > 10) return '#f59e0b'; // Warm
    return '#10b981'; // Green / Low utilization
  };

  const rows = selectedWarehouse?.rowsCount || 5;
  const shelves = selectedWarehouse?.shelvesCount || 4;
  const bins = selectedWarehouse?.binsCount || 6;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            3D Warehouse Visualizer
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Isometric spatial map tracking inventory layouts, shelf assignments, and bin utilization
            heatmaps.
          </Typography>
        </Box>
        <Box sx={{ minWidth: 200 }}>
          <TextField
            select
            label="Select Warehouse"
            fullWidth
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            sx={textFieldStyle}
          >
            {warehouses.map((w) => (
              <MenuItem key={w._id} value={w._id}>
                {w.name} ({w.code})
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>

      <Grid container spacing={3.5}>
        <Grid item xs={12} md={8}>
          <Paper className="glass-panel" sx={{ p: 3, overflowX: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <WarehouseIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Isometric Grid Layout (Rows 1-{rows})
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                alignItems: 'center',
                py: 4,
                minWidth: '600px',
              }}
            >
              {Array.from({ length: rows }).map((_, rIdx) => {
                const rNum = rIdx + 1;
                return (
                  <Box
                    key={rNum}
                    sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      Row {rNum}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      {Array.from({ length: shelves }).map((_, sIdx) => {
                        const sNum = sIdx + 1;
                        return (
                          <Box
                            key={sNum}
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: 1.5,
                              p: 1,
                              bgcolor: 'rgba(0,0,0,0.1)',
                            }}
                          >
                            <Typography
                              variant="caption"
                              align="center"
                              sx={{ fontSize: '0.65rem', mb: 0.5, color: 'text.disabled' }}
                            >
                              Shelf {sNum}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              {Array.from({ length: bins }).map((_, bIdx) => {
                                const bNum = bIdx + 1;
                                const isSelected =
                                  activeSlot?.row === rNum &&
                                  activeSlot?.shelf === sNum &&
                                  activeSlot?.bin === bNum;
                                return (
                                  <Box
                                    key={bNum}
                                    onClick={() =>
                                      setActiveSlot({ row: rNum, shelf: sNum, bin: bNum })
                                    }
                                    sx={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: 0.5,
                                      bgcolor: getCapacityColor(rNum, sNum, bNum),
                                      cursor: 'pointer',
                                      border: isSelected
                                        ? '2px solid #8b5cf6'
                                        : '1px solid transparent',
                                      boxShadow: isSelected ? '0 0 10px #8b5cf6' : 'none',
                                      transition: 'all 0.2s',
                                      '&:hover': {
                                        transform: 'scale(1.25)',
                                      },
                                    }}
                                  />
                                );
                              })}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {/* Heatmap Legend */}
            <Box sx={{ display: 'flex', gap: 3, justifyContent: 'center', mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: 0.5,
                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  Empty Slot
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: '#10b981' }} />
                <Typography variant="caption" color="text.secondary">
                  Low utilization
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: '#f59e0b' }} />
                <Typography variant="caption" color="text.secondary">
                  Half Full
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: '#ef4444' }} />
                <Typography variant="caption" color="text.secondary">
                  Near Capacity
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card className="glass-panel" sx={{ p: 1, height: '100%' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <InfoIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Shelf Inspector
                </Typography>
              </Box>

              {activeSlot ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 750 }}>
                    Bin coordinates: R-{activeSlot.row} / S-{activeSlot.shelf} / B-{activeSlot.bin}
                  </Typography>

                  {(() => {
                    const prod = getProductAtSlot(activeSlot.row, activeSlot.shelf, activeSlot.bin);
                    if (!prod) {
                      return (
                        <Box
                          sx={{
                            p: 2,
                            bgcolor: 'rgba(255,255,255,0.02)',
                            borderRadius: 2,
                            textAlign: 'center',
                          }}
                        >
                          <Chip
                            label="Empty Shelf Bin"
                            color="default"
                            size="small"
                            sx={{ mb: 1 }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            This coordinate is currently available for catalog allocation.
                          </Typography>
                        </Box>
                      );
                    }
                    <Box
                      sx={{
                        p: 2,
                        bgcolor: 'rgba(139,92,246,0.04)',
                        borderRadius: 2,
                        border: '1px solid rgba(139,92,246,0.1)',
                      }}
                    >
                      <Box sx={{ width: '100%' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {prod.name}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" display="block" color="text.secondary">
                            SKU: {prod.sku}
                          </Typography>
                          <Typography
                            variant="subtitle2"
                            sx={{ mt: 1, fontWeight: 800, color: 'secondary.light' }}
                          >
                            Current Qty: {prod.qty} units
                          </Typography>
                        </Box>
                      </Box>
                    </Box>;
                  })()}
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontStyle: 'italic', textAlign: 'center', py: 8 }}
                >
                  Click any slot on the grid visualizer to inspect shelves.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
