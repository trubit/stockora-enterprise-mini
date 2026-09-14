import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PosIcon from '@mui/icons-material/PointOfSale';
import InventoryIcon from '@mui/icons-material/Inventory';
import CategoryIcon from '@mui/icons-material/Category';
import SettingsIcon from '@mui/icons-material/Settings';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { useAuthStore } from '../store/auth.ts';
import { hasPermission } from '../../shared/permissions.js';

interface QuickSearchModalProps {
  open: boolean;
  onClose: () => void;
}

interface SearchItem {
  title: string;
  desc: string;
  path: string;
  icon: React.ReactNode;
  category: string;
  permission?: string;
}

const searchItems: SearchItem[] = [
  {
    title: 'Dashboard Overview',
    desc: 'Main sales & stock KPIs',
    path: '/',
    icon: <DashboardIcon />,
    category: 'Core',
  },
  {
    title: 'POS Checkout Terminal',
    desc: 'Process customer orders & receipt generation',
    path: '/pos',
    icon: <PosIcon />,
    category: 'Core',
    permission: 'transactions:write',
  },
  {
    title: 'Product Catalog',
    desc: 'Manage products, SKUs, and pricing',
    path: '/products',
    icon: <CategoryIcon />,
    category: 'Catalog',
    permission: 'products:read',
  },
  {
    title: 'Inventory Stock Catalog',
    desc: 'Track stock counts, batches, and reorders',
    path: '/inventory',
    icon: <InventoryIcon />,
    category: 'Inventory',
    permission: 'products:read',
  },
  {
    title: 'Stock Adjustments',
    desc: 'Reconcile stock count discrepancies',
    path: '/adjustments',
    icon: <SwapHorizIcon />,
    category: 'Logistics',
    permission: 'products:write',
  },
  {
    title: 'Warehouse Transfers',
    desc: 'Move stock between warehouse branches',
    path: '/transfers',
    icon: <StorefrontIcon />,
    category: 'Logistics',
    permission: 'warehouses:read',
  },
  {
    title: 'Purchase Orders',
    desc: 'Manage supplier restock procurement',
    path: '/purchase-orders',
    icon: <ShoppingCartIcon />,
    category: 'Procurement',
    permission: 'suppliers:read',
  },
  {
    title: 'Financial Reports',
    desc: 'Profitability, sales tax & revenue analytics',
    path: '/finance',
    icon: <AnalyticsIcon />,
    category: 'Finance',
    permission: 'transactions:read',
  },
  {
    title: 'AI Copilot Assistant',
    desc: 'Smart reorder suggestions & anomaly analysis',
    path: '/copilot/chat',
    icon: <AutoAwesomeIcon />,
    category: 'AI Tools',
  },
  {
    title: 'Company Settings',
    desc: 'Manage workspace details and preferences',
    path: '/company/settings',
    icon: <SettingsIcon />,
    category: 'Settings',
    permission: 'companies:read',
  },
];

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  const filtered = searchItems
    .filter((item) => hasPermission(user, item.permission))
    .filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.desc.toLowerCase().includes(query.toLowerCase()) ||
        item.category.toLowerCase().includes(query.toLowerCase())
    );

  const handleSelect = (path: string) => {
    navigate(path);
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #0b0f19 0%, #030712 100%) !important',
          border: '1px solid rgba(139, 92, 246, 0.25) !important',
          borderRadius: '16px !important',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.8) !important',
          overflow: 'hidden',
          p: 0,
        },
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <TextField
          autoFocus
          fullWidth
          placeholder="Search modules, pages, actions... (e.g. POS, Inventory, AI)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          variant="outlined"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#8b5cf6' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Chip
                  label="ESC to exit"
                  size="small"
                  sx={{
                    fontSize: '0.68rem',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    color: '#9ca3af',
                  }}
                />
              </InputAdornment>
            ),
            sx: {
              backgroundColor: 'transparent !important',
              '& fieldset': { border: 'none !important' },
              fontSize: '1rem',
              color: '#f8fafc',
            },
          }}
        />
      </Box>

      <DialogContent sx={{ p: 1, maxHeight: '420px', overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#9ca3af' }}>
              No navigation targets found for "{query}".
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filtered.map((item) => (
              <ListItemButton
                key={item.path}
                onClick={() => handleSelect(item.path)}
                sx={{
                  borderRadius: '10px',
                  mb: 0.5,
                  p: 1.5,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: 'rgba(139, 92, 246, 0.12)',
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <ListItemIcon sx={{ color: '#a78bfa', minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                        {item.title}
                      </Typography>
                      <Chip
                        label={item.category}
                        size="small"
                        sx={{
                          fontSize: '0.65rem',
                          height: '18px',
                          backgroundColor: 'rgba(139, 92, 246, 0.15)',
                          color: '#c084fc',
                        }}
                      />
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                      {item.desc}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuickSearchModal;
