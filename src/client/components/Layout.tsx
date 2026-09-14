import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Badge,
  Tooltip,
  Chip,
} from '@mui/material';
import type { Theme } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PosIcon from '@mui/icons-material/PointOfSale';
import InventoryIcon from '@mui/icons-material/Inventory';
import OnlineIcon from '@mui/icons-material/SignalCellularAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import BranchIcon from '@mui/icons-material/Storefront';
import LogoutIcon from '@mui/icons-material/Logout';
import BusinessIcon from '@mui/icons-material/Business';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import PeopleIcon from '@mui/icons-material/People';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CategoryIcon from '@mui/icons-material/Category';
import AdjustIcon from '@mui/icons-material/Adjust';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ReceiptIcon from '@mui/icons-material/Receipt';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import PaymentsIcon from '@mui/icons-material/Payments';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import QueryBuilderIcon from '@mui/icons-material/QueryBuilder';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LoyaltyIcon from '@mui/icons-material/Loyalty';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import UsbIcon from '@mui/icons-material/Usb';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import PublicIcon from '@mui/icons-material/Public';
import { useAuthStore } from '../store/auth.ts';
import { hasPermission, isPlatformSuperAdmin } from '../../shared/permissions.js';
import { apiClient } from '../api/client.ts';
import QuickSearchModal from './QuickSearchModal.tsx';
import SearchIcon from '@mui/icons-material/Search';
import { TenantSwitcher } from './Tenant/TenantSwitcher.tsx';
import { LanguageSelector } from './LanguageSelector.tsx';
import { CurrencySelector } from './CurrencySelector.tsx';
import { useTranslation } from '../hooks/useTranslation.js';

const drawerWidth = 260;

export default function Layout() {
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, accessToken, setUser, clearSession } = useAuthStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (accessToken && !user) {
        try {
          // Use /auth/me to re-hydrate user on page refresh.
          // The 401 interceptor in apiClient will handle expired tokens automatically.
          const { data } = await apiClient.get('/auth/me');
          setUser(data);
        } catch (err: unknown) {
          // Only clear session if it's a genuine 401 (handled by the interceptor).
          // Network or server errors should NOT log the user out.
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 401) {
            clearSession();
            navigate('/login');
          }
          // For all other errors (500, network), keep the session alive and let the user retry.
        }
      }
    };
    fetchUserProfile();
  }, [accessToken, user, setUser, clearSession, navigate]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleDrawerToggle = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setMobileOpen((prev) => !prev);
  };

  const handleMobileNav = (path: string) => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setMobileOpen(false);
    navigate(path);
  };

  const menuItems = [
    { text: t('common.dashboard'), icon: <DashboardIcon />, path: '/' },
    {
      text: 'AI Intelligence Console',
      icon: <AutoAwesomeIcon />,
      path: '/ai/intelligence',
      permission: 'ai:view',
    },
    {
      text: t('common.pos'),
      icon: <PosIcon />,
      path: '/pos',
      permission: 'transactions:write',
    },
    {
      text: t('pos.terminal'),
      icon: <PosIcon />,
      path: '/pos/terminal',
      permission: 'transactions:write',
    },
    {
      text: 'Cash Register Shift',
      icon: <PointOfSaleIcon />,
      path: '/pos/register',
      permission: 'transactions:write',
    },
    {
      text: 'POS Held Sales Queue',
      icon: <ShoppingCartIcon />,
      path: '/pos/held-sales',
      permission: 'transactions:read',
    },
    {
      text: 'Omnichannel Orders',
      icon: <ShoppingCartIcon />,
      path: '/commerce/orders',
      permission: 'transactions:read',
    },
    {
      text: 'Commerce Returns & Refunds',
      icon: <AssignmentReturnIcon />,
      path: '/commerce/returns',
      permission: 'returns:read',
    },
    {
      text: 'Commerce Analytics & AI',
      icon: <AutoAwesomeIcon />,
      path: '/commerce/analytics',
      permission: 'products:read',
    },
    {
      text: 'Sales Analytics',
      icon: <AutoAwesomeIcon />,
      path: '/sales/analytics',
      permission: 'products:read',
    },
    {
      text: 'Sales Order Builder',
      icon: <ShoppingCartIcon />,
      path: '/sales/builder',
      permission: 'products:write',
    },
    {
      text: 'Sales Quotations',
      icon: <ReceiptIcon />,
      path: '/sales/quotes',
      permission: 'products:read',
    },
    {
      text: 'Tiered Price Lists',
      icon: <CategoryIcon />,
      path: '/sales/price-lists',
      permission: 'products:read',
    },
    {
      text: 'Sales Channels',
      icon: <OnlineIcon />,
      path: '/sales/channels',
      permission: 'products:read',
    },
    {
      text: 'Sales Reps & Territories',
      icon: <CategoryIcon />,
      path: '/sales/territories',
      permission: 'products:read',
    },
    {
      text: 'Products Catalog',
      icon: <CategoryIcon />,
      path: '/products',
      permission: 'products:read',
    },
    {
      text: t('common.inventory'),
      icon: <InventoryIcon />,
      path: '/inventory',
      permission: 'products:read',
    },
    {
      text: 'Inventory Intelligence',
      icon: <AutoAwesomeIcon />,
      path: '/inventory/intelligence',
      permission: 'products:read',
    },
    {
      text: 'Demand Forecasting',
      icon: <OnlineIcon />,
      path: '/inventory/forecasting',
      permission: 'products:read',
    },
    {
      text: 'Smart Replenishment',
      icon: <ShoppingCartIcon />,
      path: '/inventory/reorder',
      permission: 'products:read',
    },
    {
      text: 'Supplier Intelligence',
      icon: <LocalShippingIcon />,
      path: '/inventory/suppliers',
      permission: 'products:read',
    },
    {
      text: 'Stock Optimization',
      icon: <AdjustIcon />,
      path: '/inventory/optimization',
      permission: 'products:read',
    },
    {
      text: 'CRM Dashboard',
      icon: <PeopleIcon />,
      path: '/crm/dashboard',
      permission: 'customers:read',
    },
    {
      text: 'Customer 360',
      icon: <AccountCircleIcon />,
      path: '/crm/customer360',
      permission: 'customers:read',
    },
    {
      text: 'Customer Segments',
      icon: <CategoryIcon />,
      path: '/crm/segments',
      permission: 'customers:read',
    },
    {
      text: 'Loyalty Program',
      icon: <LoyaltyIcon />,
      path: '/crm/loyalty',
      permission: 'customers:read',
    },
    {
      text: 'Campaign Manager',
      icon: <NotificationsActiveIcon />,
      path: '/crm/campaigns',
      permission: 'promotions:read',
    },
    {
      text: 'Coupons & Discounts',
      icon: <ReceiptIcon />,
      path: '/crm/coupons',
      permission: 'promotions:read',
    },
    {
      text: 'Customer Retention & Churn',
      icon: <AutoAwesomeIcon />,
      path: '/crm/retention',
      permission: 'customers:read',
    },
    {
      text: 'Customer Journeys',
      icon: <OnlineIcon />,
      path: '/crm/journeys',
      permission: 'customers:read',
    },
    {
      text: 'Stock Adjustments',
      icon: <AdjustIcon />,
      path: '/adjustments',
      permission: 'products:write',
    },
    {
      text: 'Warehouse Transfers',
      icon: <SwapHorizIcon />,
      path: '/transfers',
      permission: 'warehouses:read',
    },
    {
      text: 'Warehouses Directory',
      icon: <WarehouseIcon />,
      path: '/warehouse/warehouses',
      permission: 'warehouses:read',
    },
    {
      text: 'WMS Operations Center',
      icon: <WarehouseIcon />,
      path: '/warehouse/dashboard',
      permission: 'warehouses:read',
    },
    {
      text: 'WMS Hierarchy & Bins',
      icon: <CategoryIcon />,
      path: '/warehouse/locations',
      permission: 'warehouses:read',
    },
    {
      text: 'WMS Stock Transfers',
      icon: <SwapHorizIcon />,
      path: '/warehouse/transfers',
      permission: 'warehouses:read',
    },
    {
      text: 'WMS Put-Away Console',
      icon: <InventoryIcon />,
      path: '/warehouse/putaway',
      permission: 'warehouses:read',
    },
    {
      text: 'WMS Barcode Pick Console',
      icon: <AdjustIcon />,
      path: '/warehouse/picking',
      permission: 'warehouses:read',
    },
    {
      text: 'WMS Packing Station',
      icon: <InventoryIcon />,
      path: '/warehouse/packing',
      permission: 'warehouses:read',
    },
    {
      text: 'WMS Carrier Dispatch',
      icon: <LocalShippingIcon />,
      path: '/warehouse/dispatch',
      permission: 'warehouses:read',
    },
    {
      text: 'WMS Package Manifests',
      icon: <ReceiptIcon />,
      path: '/warehouse/manifests',
      permission: 'warehouses:read',
    },
    {
      text: 'WMS Cycle Count & Audits',
      icon: <AdjustIcon />,
      path: '/warehouse/counting',
      permission: 'warehouses:read',
    },
    {
      text: 'WMS Inventory Exceptions',
      icon: <AdjustIcon />,
      path: '/warehouse/exceptions',
      permission: 'warehouses:read',
    },
    {
      text: 'Purchase Orders',
      icon: <ShoppingCartIcon />,
      path: '/purchase-orders',
      permission: 'suppliers:read',
    },
    {
      text: 'Receiving AP',
      icon: <ReceiptIcon />,
      path: '/receiving',
      permission: 'suppliers:read',
    },
    {
      text: 'Procurement Dashboard',
      icon: <ShoppingCartIcon />,
      path: '/procurement',
      permission: 'suppliers:read',
    },
    {
      text: 'Supplier Management',
      icon: <LocalShippingIcon />,
      path: '/procurement/suppliers',
      permission: 'suppliers:read',
    },
    {
      text: 'Supplier Comparison Matrix',
      icon: <AutoAwesomeIcon />,
      path: '/procurement/supplier-comparison',
      permission: 'suppliers:read',
    },
    {
      text: 'Automated Replenishment',
      icon: <AutoAwesomeIcon />,
      path: '/procurement/replenishment',
      permission: 'suppliers:read',
    },
    {
      text: 'Purchase Requests',
      icon: <ReceiptIcon />,
      path: '/procurement/requests',
      permission: 'suppliers:read',
    },
    {
      text: 'PO Management Console',
      icon: <ShoppingCartIcon />,
      path: '/procurement/purchase-orders',
      permission: 'suppliers:read',
    },
    {
      text: 'Landed Cost Allocation',
      icon: <PaymentsIcon />,
      path: '/procurement/landed-cost',
      permission: 'suppliers:read',
    },
    {
      text: 'Procurement Budgets',
      icon: <BusinessIcon />,
      path: '/procurement/budgets',
      permission: 'suppliers:read',
    },
    {
      text: 'Barcode Goods Receiving',
      icon: <InventoryIcon />,
      path: '/procurement/receiving',
      permission: 'suppliers:read',
    },
    {
      text: 'Supplier Returns & Credit',
      icon: <AssignmentReturnIcon />,
      path: '/procurement/returns',
      permission: 'suppliers:read',
    },
    {
      text: 'Three-Way Invoice Matching',
      icon: <ReceiptIcon />,
      path: '/procurement/three-way-matching',
      permission: 'suppliers:read',
    },
    {
      text: 'Procurement Analytics AI',
      icon: <AutoAwesomeIcon />,
      path: '/procurement/analytics',
      permission: 'suppliers:read',
    },
    {
      text: 'Supplier Products Catalog',
      icon: <CategoryIcon />,
      path: '/procurement/products',
      permission: 'suppliers:read',
    },
    {
      text: 'Quality Inspection Console',
      icon: <AdjustIcon />,
      path: '/procurement/inspections',
      permission: 'suppliers:read',
    },
    {
      text: 'Procurement Settings',
      icon: <CategoryIcon />,
      path: '/procurement/settings',
      permission: 'suppliers:read',
    },
    {
      text: 'Sales Orders',
      icon: <PointOfSaleIcon />,
      path: '/sales',
      permission: 'transactions:read',
    },
    {
      text: 'Sales Returns & RMAs',
      icon: <AssignmentReturnIcon />,
      path: '/returns',
      permission: 'returns:read',
    },
    {
      text: 'Marketing & Loyalty',
      icon: <LoyaltyIcon />,
      path: '/marketing',
      permission: 'promotions:read',
    },
    {
      text: 'Communication Center',
      icon: <NotificationsActiveIcon />,
      path: '/communication',
      permission: 'notifications:read',
    },
    {
      text: 'Financial Reports',
      icon: <PaymentsIcon />,
      path: '/finance',
      permission: 'transactions:read',
    },
    {
      text: 'Finance Dashboard',
      icon: <PaymentsIcon />,
      path: '/finance/dashboard',
      permission: 'transactions:read',
    },
    {
      text: 'Chart of Accounts',
      icon: <PaymentsIcon />,
      path: '/finance/accounts',
      permission: 'transactions:read',
    },
    {
      text: 'Journal Entries',
      icon: <PaymentsIcon />,
      path: '/finance/journals',
      permission: 'transactions:read',
    },
    {
      text: 'General Ledger',
      icon: <PaymentsIcon />,
      path: '/finance/ledger',
      permission: 'transactions:read',
    },
    {
      text: 'Financial Statements',
      icon: <PaymentsIcon />,
      path: '/finance/statements',
      permission: 'transactions:read',
    },
    {
      text: 'Expenses Manager',
      icon: <PaymentsIcon />,
      path: '/finance/expenses',
      permission: 'transactions:read',
    },
    {
      text: 'AR & AP Management',
      icon: <PaymentsIcon />,
      path: '/finance/ar-ap',
      permission: 'transactions:read',
    },
    {
      text: 'Bank Reconciliation',
      icon: <PaymentsIcon />,
      path: '/finance/banking',
      permission: 'transactions:read',
    },
    {
      text: 'Tax Management',
      icon: <PaymentsIcon />,
      path: '/finance/tax',
      permission: 'transactions:read',
    },
    {
      text: 'Fiscal Periods',
      icon: <PaymentsIcon />,
      path: '/finance/periods',
      permission: 'transactions:read',
    },
    {
      text: 'Budgeting & Variance',
      icon: <PaymentsIcon />,
      path: '/finance/budgets',
      permission: 'transactions:read',
    },
    {
      text: 'Executive Dashboard',
      icon: <PaymentsIcon />,
      path: '/company/analytics/executive',
      permission: 'reports:read',
    },
    {
      text: 'Sales Intelligence',
      icon: <AutoAwesomeIcon />,
      path: '/company/analytics/sales',
      permission: 'reports:read',
    },
    {
      text: 'Inventory Intelligence',
      icon: <CategoryIcon />,
      path: '/company/analytics/inventory',
      permission: 'products:read',
    },
    {
      text: 'Customer Retention',
      icon: <PeopleIcon />,
      path: '/company/analytics/customers',
      permission: 'customers:read',
    },
    {
      text: 'Supplier Intelligence',
      icon: <LocalShippingIcon />,
      path: '/company/analytics/suppliers',
      permission: 'suppliers:read',
    },
    {
      text: 'Financial Margins',
      icon: <PaymentsIcon />,
      path: '/company/analytics/finance',
      permission: 'transactions:read',
    },
    {
      text: 'Demand Forecasting',
      icon: <AutoAwesomeIcon />,
      path: '/company/analytics/forecast',
      permission: 'reports:read',
    },
    {
      text: 'Anomaly Signals',
      icon: <CategoryIcon />,
      path: '/company/analytics/anomalies',
      permission: 'reports:read',
    },
    {
      text: 'Strategic KPI Console',
      icon: <DashboardIcon />,
      path: '/company/analytics/kpis',
      permission: 'reports:read',
    },
    {
      text: 'Report Builder',
      icon: <SettingsIcon />,
      path: '/reports/builder',
      permission: 'reports:read',
    },
    {
      text: 'Saved Reports',
      icon: <ReceiptIcon />,
      path: '/reports/saved',
      permission: 'reports:read',
    },
    {
      text: 'Scheduled Reports',
      icon: <QueryBuilderIcon />,
      path: '/reports/scheduled',
      permission: 'reports:read',
    },
    {
      text: 'Export Logs',
      icon: <CategoryIcon />,
      path: '/reports/exports',
      permission: 'reports:read',
    },
    { text: 'AI Copilot Assistant', icon: <AutoAwesomeIcon />, path: '/copilot/chat' },
    {
      text: 'AI Copilot Settings',
      icon: <SettingsIcon />,
      path: '/copilot/settings',
      permission: 'security:write',
    },
    {
      text: 'Workflow BPM Designer',
      icon: <SettingsIcon />,
      path: '/workflows/designer',
      permission: 'workflows:write',
    },
    {
      text: 'Workflow History',
      icon: <QueryBuilderIcon />,
      path: '/workflows/history',
      permission: 'workflows:read',
    },
    {
      text: 'Approvals Console',
      icon: <PaymentsIcon />,
      path: '/workflows/approvals',
      permission: 'workflows:read',
    },
    {
      text: 'Operations Center (SRE)',
      icon: <DashboardIcon />,
      path: '/observability/operations',
      permission: 'security:read',
    },
    {
      text: 'Audit Explorer',
      icon: <SettingsIcon />,
      path: '/observability/audit',
      permission: 'audit:read',
    },
    { text: 'My Profile', icon: <AccountCircleIcon />, path: '/profile' },
  ];

  const isSuperAdmin = isPlatformSuperAdmin(user);

  const isAdmin =
    user?.roleName === 'Company Owner' ||
    user?.roleName === 'Super Administrator' ||
    Boolean((user as any)?.isPlatformAdmin);

  const hasAccess = (permission?: string) => {
    return hasPermission(user, permission);
  };

  const adminItems = [
    {
      text: 'Company SaaS Settings',
      icon: <BusinessIcon />,
      path: '/company/settings',
      permission: 'companies:read',
    },
    {
      text: t('common.regionalSettings'),
      icon: <PublicIcon />,
      path: '/company/settings/regional',
      permission: 'companies:read',
    },
    {
      text: 'SaaS Billing & Invoices',
      icon: <PaymentsIcon />,
      path: '/company/billing',
      permission: 'companies:read',
    },
    {
      text: 'Resource Usage & Quotas',
      icon: <DashboardIcon />,
      path: '/company/usage',
      permission: 'companies:read',
    },
    {
      text: 'Pricing & Plans Catalog',
      icon: <AutoAwesomeIcon />,
      path: '/pricing',
    },
    {
      text: 'Platform Billing Admin',
      icon: <AdminPanelSettingsIcon />,
      path: '/admin/billing',
      platformOnly: true,
    },
    {
      text: 'Onboard New Company',
      icon: <BusinessIcon />,
      path: '/onboarding',
      permission: 'companies:write',
    },

    {
      text: 'Platform Admin Hub',
      icon: <AdminPanelSettingsIcon />,
      path: '/admin/platform',
      platformOnly: true,
    },
    { text: 'Branches List', icon: <BranchIcon />, path: '/branches', permission: 'branches:read' },
    {
      text: 'Currency & Tax Settings',
      icon: <PaymentsIcon />,
      path: '/currency',
      permission: 'finance:read',
    },
    {
      text: 'Hardware Terminals',
      icon: <UsbIcon />,
      path: '/hardware',
      permission: 'security:read',
    },
    {
      text: 'Integration Hub',
      icon: <CloudQueueIcon />,
      path: '/company/integrations',
      permission: 'security:read',
    },
    {
      text: 'Developer API Keys',
      icon: <SettingsIcon />,
      path: '/company/developer/api-keys',
      permission: 'security:read',
    },
    {
      text: 'Webhooks & Events',
      icon: <AutoAwesomeIcon />,
      path: '/company/developer/webhooks',
      permission: 'security:read',
    },
    {
      text: 'Data Import Wizard',
      icon: <CategoryIcon />,
      path: '/company/import',
      permission: 'master_data:read',
    },
    {
      text: 'Data Export Center',
      icon: <ReceiptIcon />,
      path: '/company/export',
      permission: 'reports:read',
    },
    {
      text: '3D Warehouse Visualizer',
      icon: <WarehouseIcon />,
      path: '/warehouse-visualizer',
      permission: 'warehouses:read',
    },
    {
      text: 'Master Data',
      icon: <SettingsIcon />,
      path: '/master-data',
      permission: 'master_data:read',
    },
    {
      text: 'Suppliers Directory',
      icon: <LocalShippingIcon />,
      path: '/suppliers',
      permission: 'suppliers:read',
    },
    {
      text: 'Customers Directory',
      icon: <PeopleIcon />,
      path: '/customers',
      permission: 'customers:read',
    },
    {
      text: 'Scheduler Monitor',
      icon: <QueryBuilderIcon />,
      path: '/scheduler',
      permission: 'automation:read',
    },
    {
      text: 'Admin Console',
      icon: <AdminPanelSettingsIcon />,
      path: '/console',
      platformOnly: true,
    },
  ];

  const showAdminSection =
    isAdmin ||
    adminItems.some((item: any) => (item.platformOnly ? isSuperAdmin : hasAccess(item.permission)));

  const drawerContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#090f1d',
        backgroundImage: 'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.08) 0px, transparent 50%)',
      }}
    >
      {/* Brand Header */}
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar
          src="/logo.png"
          sx={{
            bgcolor: 'primary.main',
            width: 40,
            height: 40,
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
          }}
        />
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                letterSpacing: '0.04em',
                lineHeight: 1.1,
                background: 'linear-gradient(135deg, #ffffff 0%, #a7f3d0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              STOCKORA
            </Typography>
            <Chip
              label="MINI"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.6rem',
                fontWeight: 800,
                fontFamily: "'Space Grotesk', sans-serif",
                color: '#040711',
                background: 'linear-gradient(135deg, #34d399 0%, #06b6d4 100%)',
                border: 'none',
                borderRadius: '6px',
                px: 0.6,
                letterSpacing: '0.06em',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          </Box>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: 600,
              fontSize: '0.68rem',
              letterSpacing: '0.04em',
            }}
          >
            {t('RETAIL & INVENTORY')}
          </Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />

      {/* Navigation List */}
      <Box sx={{ flexGrow: 1, overflowY: 'auto', px: 1.5, py: 2 }}>
        <List disablePadding>
          {menuItems
            .filter((item) => hasAccess(item.permission))
            .map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    className={isActive ? 'premium-sidebar-item active' : 'premium-sidebar-item'}
                    onClick={() => handleMobileNav(item.path)}
                    sx={{
                      borderRadius: '8px',
                      color: isActive ? '#ffffff' : 'text.secondary',
                      bgcolor: isActive ? 'rgba(139, 92, 246, 0.08) !important' : 'transparent',
                      borderLeft: isActive ? '3px solid #8b5cf6' : '3px solid transparent',
                      '&:hover': {
                        bgcolor: isActive
                          ? 'rgba(139, 92, 246, 0.12)'
                          : 'rgba(255, 255, 255, 0.02)',
                        color: '#ffffff',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{ color: isActive ? 'primary.light' : 'text.secondary', minWidth: 38 }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={t(item.text)}
                      primaryTypographyProps={{
                        fontSize: '0.85rem',
                        fontWeight: isActive ? 700 : 500,
                        letterSpacing: '0.01em',
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}

          {showAdminSection && (
            <>
              <Divider sx={{ my: 2.5, borderColor: 'rgba(255,255,255,0.03)' }} />
              <Typography
                variant="caption"
                sx={{
                  px: 2.5,
                  color: '#a78bfa',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  display: 'block',
                  mb: 1,
                  fontSize: '0.68rem',
                }}
              >
                {t('ADMINISTRATION')}
              </Typography>
              {adminItems
                .filter((item: any) =>
                  item.platformOnly ? isSuperAdmin : hasAccess(item.permission)
                )
                .map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton
                        className={
                          isActive ? 'premium-sidebar-item active' : 'premium-sidebar-item'
                        }
                        onClick={() => handleMobileNav(item.path)}
                        sx={{
                          borderRadius: '8px',
                          color: isActive ? '#ffffff' : 'text.secondary',
                          bgcolor: isActive ? 'rgba(139, 92, 246, 0.08) !important' : 'transparent',
                          borderLeft: isActive ? '3px solid #8b5cf6' : '3px solid transparent',
                          '&:hover': {
                            bgcolor: isActive
                              ? 'rgba(139, 92, 246, 0.12)'
                              : 'rgba(255, 255, 255, 0.02)',
                            color: '#ffffff',
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color: isActive ? 'primary.light' : 'text.secondary',
                            minWidth: 38,
                          }}
                        >
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={t(item.text)}
                          primaryTypographyProps={{
                            fontSize: '0.85rem',
                            fontWeight: isActive ? 700 : 500,
                            letterSpacing: '0.01em',
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
            </>
          )}

          <Divider sx={{ my: 2.5, borderColor: 'rgba(255,255,255,0.03)' }} />
          <ListItem disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={async () => {
                try {
                  const refreshToken = localStorage.getItem('stockora_mini_refresh_token');
                  // Tell the server to revoke the session and refresh token
                  await apiClient.post('/auth/logout', { refreshToken }, {
                    _skipGlobalErrorToast: true,
                  } as any);
                } catch {
                  // Even if the server call fails, clean up client state
                }
                clearSession();
                navigate('/login');
              }}
              sx={{
                borderRadius: '8px',
                color: 'error.light',
                mx: '8px',
                '&:hover': {
                  bgcolor: 'rgba(239, 68, 68, 0.06)',
                  color: 'error.main',
                },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit', minWidth: 38 }}>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText
                primary="Sign Out"
                primaryTypographyProps={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.04)' }} />
      {/* Footer Profile */}
      <Box
        sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'rgba(0,0,0,0.1)' }}
      >
        <Avatar
          src={user?.avatarUrl || undefined}
          sx={{
            cursor: 'pointer',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            boxShadow: '0 0 12px rgba(139, 92, 246, 0.25)',
            border: '2px solid rgba(139, 92, 246, 0.3)',
          }}
          onClick={() => navigate('/profile')}
        >
          {user?.username?.charAt(0).toUpperCase() || 'U'}
        </Avatar>
        <Box
          sx={{ overflow: 'hidden', cursor: 'pointer', flexGrow: 1 }}
          onClick={() => navigate('/profile')}
        >
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, fontSize: '0.825rem' }}>
            {user?.username || 'Guest User'}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            display="block"
            sx={{ fontSize: '0.7rem' }}
          >
            {user?.roleName || 'Employee'}
          </Typography>
        </Box>
        <IconButton
          size="small"
          sx={{ color: 'text.secondary' }}
          onClick={() => handleMobileNav('/profile')}
        >
          <SettingsIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#07090e' }}>
      {/* Top Navbar */}
      <AppBar
        position="fixed"
        className="glass-panel"
        sx={{
          zIndex: (theme: Theme) => theme.zIndex.drawer + 1,
          boxShadow: 'none',
          background: 'rgba(7, 9, 14, 0.75) !important',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05) !important',
        }}
      >
        <Toolbar
          sx={{
            justifyContent: 'space-between',
            px: { xs: 1.5, sm: 3 },
            minHeight: { xs: 56, sm: 64 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onMouseDown={(e) => {
                // Prevent mouse focus retention before modal mounts and marks #root aria-hidden
                e.preventDefault();
              }}
              onClick={(e) => {
                e.currentTarget.blur();
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                handleDrawerToggle();
              }}
              sx={{ mr: { xs: 0.5, sm: 1 }, display: { md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            {/* SaaS Multi-Tenant Organization Switcher */}
            <TenantSwitcher />
          </Box>

          {/* Quick Search Jump Bar */}
          <Chip
            icon={<SearchIcon style={{ color: '#8b5cf6', fontSize: 16 }} />}
            label="Search modules... (Ctrl+K)"
            onClick={() => setSearchOpen(true)}
            sx={{
              display: { xs: 'none', md: 'flex' },
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              color: '#9ca3af',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontWeight: 600,
              fontSize: '0.78rem',
              px: 1,
              py: 1.8,
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'rgba(139, 92, 246, 0.12)',
                borderColor: 'rgba(139, 92, 246, 0.3)',
                color: '#ffffff',
              },
            }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
            {/* System Status Indicators */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1.5 }}>
              <Tooltip
                title={
                  isOnline ? 'System Online (Vite/Server Connection Stable)' : 'Offline Mode Active'
                }
              >
                <Badge
                  variant="dot"
                  color={isOnline ? 'success' : 'error'}
                  sx={{
                    '& .MuiBadge-badge': {
                      animation: isOnline ? 'ripple 1.2s infinite ease-in-out' : 'none',
                    },
                    '@keyframes ripple': {
                      '0%': { transform: 'scale(.8)', opacity: 1 },
                      '100%': { transform: 'scale(2.4)', opacity: 0 },
                    },
                  }}
                >
                  <OnlineIcon
                    sx={{ color: isOnline ? 'secondary.main' : 'error.main', fontSize: '1.15rem' }}
                  />
                </Badge>
              </Tooltip>
              <Typography
                variant="caption"
                sx={{
                  color: isOnline ? 'secondary.light' : 'error.light',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  fontSize: '0.7rem',
                }}
              >
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Typography>
            </Box>

            <Divider
              orientation="vertical"
              flexItem
              sx={{ display: { xs: 'none', sm: 'block' }, borderColor: 'rgba(255,255,255,0.06)' }}
            />

            {/* Dynamic Multi-Currency Selector */}
            <CurrencySelector />

            {/* Globalization Language Selector */}
            <LanguageSelector />

            {/* Shift/Operational Info */}
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontWeight: 700,
                letterSpacing: '0.04em',
                display: { xs: 'none', md: 'block' },
                bgcolor: 'rgba(255,255,255,0.02)',
                px: 1.5,
                py: 0.5,
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.04)',
              }}
            >
              SHIFT: 08:00 - 16:00
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawers */}
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: false,
            disableRestoreFocus: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawerContent}
        </Drawer>
        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              borderRight: '1px solid rgba(255, 255, 255, 0.04)',
            },
          }}
          open
        >
          {drawerContent}
        </Drawer>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2.5, md: 3.5 },
          width: { xs: '100%', md: `calc(100% - ${drawerWidth}px)` },
          maxWidth: '100vw',
          boxSizing: 'border-box',
          mt: { xs: '56px', sm: '64px' },
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: { xs: 'calc(100vh - 56px)', sm: 'calc(100vh - 64px)' },
        }}
      >
        <Box
          className="animate-fade-in"
          sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* Global Quick Jump Modal */}
      <QuickSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </Box>
  );
}
