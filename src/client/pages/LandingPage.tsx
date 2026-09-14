import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Divider,
  Paper,
} from '@mui/material';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import InventoryIcon from '@mui/icons-material/Inventory';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useRegionalSettings } from '../hooks/useRegionalSettings.js';

// Interactive preview catalog items for unauthenticated marketing landing page hero
const showcaseProducts = [
  { id: '1', name: 'Whole Milk 1L', category: 'Dairy', price: 2.49 },
  { id: '2', name: 'Sourdough Bread', category: 'Bakery', price: 3.99 },
  { id: '3', name: 'Espresso Coffee 500g', category: 'Beverages', price: 12.99 },
  { id: '4', name: 'Organic Honey 250g', category: 'Pantry', price: 7.5 },
];

export const LandingPage: React.FC = () => {
  const { formatAmount } = useRegionalSettings();
  const navigate = useNavigate();
  const [cart, setCart] = useState<{ id: string; name: string; price: number; qty: number }[]>([
    { id: '1', name: 'Whole Milk 1L', price: 2.49, qty: 2 },
    { id: '3', name: 'Espresso Coffee 500g', price: 12.99, qty: 1 },
  ]);

  const addToCart = (product: (typeof showcaseProducts)[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, qty: item.qty - 1 } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const total = subtotal;

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: '#030712', color: '#f8fafc' }}>
      {/* Top Navbar */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          backdropFilter: 'blur(16px)',
          backgroundColor: 'rgba(3, 7, 18, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          py: 2,
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}
              onClick={() => navigate('/landing')}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
                }}
              >
                <PointOfSaleIcon sx={{ color: '#040711', fontSize: 24 }} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="h5"
                  sx={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    background: 'linear-gradient(90deg, #ffffff 0%, #a7f3d0 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Stockora
                </Typography>
                <Chip
                  label="MINI"
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    fontFamily: "'Space Grotesk', sans-serif",
                    bgcolor: 'rgba(16, 185, 129, 0.15)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                  }}
                />
              </Box>
            </Box>

            <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 4 }}>
              <Button
                href="#features"
                sx={{ color: '#9ca3af', fontWeight: 600, '&:hover': { color: '#ffffff' } }}
              >
                Features
              </Button>
              <Button
                href="#pos-preview"
                sx={{ color: '#9ca3af', fontWeight: 600, '&:hover': { color: '#ffffff' } }}
              >
                Interactive POS
              </Button>
              <Button
                href="#roi"
                sx={{ color: '#9ca3af', fontWeight: 600, '&:hover': { color: '#ffffff' } }}
              >
                ROI & Stats
              </Button>
              <Button
                href="#pricing"
                sx={{ color: '#9ca3af', fontWeight: 600, '&:hover': { color: '#ffffff' } }}
              >
                Pricing
              </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                variant="text"
                onClick={() => navigate('/login')}
                sx={{ color: '#34d399', fontWeight: 700 }}
              >
                Sign In
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/signup')}
                sx={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#040711',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  borderRadius: '10px',
                  px: 3,
                  py: 1,
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.35)',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                    boxShadow: '0 6px 24px rgba(16, 185, 129, 0.5)',
                  },
                }}
              >
                Get Started
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 12 }, pb: 8 }}>
        <Box sx={{ textAlign: 'center', maxWidth: '850px', mx: 'auto', mb: 8 }}>
          <Chip
            icon={<AutoAwesomeIcon style={{ color: '#34d399', fontSize: 16 }} />}
            label="Next-Gen Enterprise POS & Inventory Platform"
            sx={{
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontWeight: 700,
              fontSize: '0.82rem',
              mb: 3,
              py: 0.5,
              px: 1,
            }}
          />

          <Typography
            variant="h1"
            sx={{
              fontWeight: 900,
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.2rem' },
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              mb: 3,
              background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 40%, #34d399 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Intelligent Stock Management & Lightning Fast POS
          </Typography>

          <Typography
            variant="h6"
            sx={{ color: '#9ca3af', fontWeight: 400, lineHeight: 1.6, mb: 4 }}
          >
            Stockora Enterprise Mini brings high-speed retail checkout, autonomous stockout alerts,
            and multi-branch terminal synchronization to your store.
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/pos')}
              endIcon={<ArrowForwardIcon />}
              sx={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#040711',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 800,
                fontSize: '1.05rem',
                borderRadius: '12px',
                px: 4,
                py: 1.6,
                boxShadow: '0 8px 30px rgba(16, 185, 129, 0.4)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                  boxShadow: '0 12px 40px rgba(16, 185, 129, 0.6)',
                },
              }}
            >
              Launch POS Simulator
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/signup')}
              sx={{
                borderColor: 'rgba(16, 185, 129, 0.35)',
                color: '#f8fafc',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                borderRadius: '12px',
                px: 4,
                py: 1.6,
                '&:hover': {
                  borderColor: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                },
              }}
            >
              Start 14-Day Free Trial
            </Button>
          </Box>
        </Box>

        {/* Hero Interactive Mini POS Preview */}
        <Box id="pos-preview" sx={{ mt: 4 }}>
          <Card
            className="glass-panel"
            sx={{
              p: { xs: 2, md: 4 },
              borderRadius: '24px',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 3,
                flexWrap: 'wrap',
                gap: 2,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <ReceiptLongIcon sx={{ color: '#10b981', fontSize: 28 }} />
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc' }}>
                  Live POS Terminal Preview
                </Typography>
              </Box>
              <Chip
                label="Interactive Terminal Preview"
                color="secondary"
                size="small"
                sx={{ fontWeight: 700 }}
              />
            </Box>

            <Grid container spacing={3}>
              {/* Showcase Catalog Grid */}
              <Grid item xs={12} md={7}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5, color: '#60a5fa' }}>
                  Live Terminal Simulation
                </Typography>
                <Grid container spacing={1.5}>
                  {showcaseProducts.map((p) => (
                    <Grid item xs={6} key={p.id}>
                      <Card
                        onClick={() => addToCart(p)}
                        sx={{
                          cursor: 'pointer',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            borderColor: '#2563eb',
                            transform: 'translateY(-2px)',
                            backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          },
                        }}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Chip
                              label={p.category}
                              size="small"
                              sx={{
                                fontSize: '0.65rem',
                                height: '18px',
                                backgroundColor: 'rgba(255,255,255,0.06)',
                              }}
                            />
                            <AddShoppingCartIcon sx={{ fontSize: 18, color: '#10b981' }} />
                          </Box>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 700, color: '#f8fafc' }}
                          >
                            {p.name}
                          </Typography>
                          <Typography
                            variant="h6"
                            sx={{ fontWeight: 800, color: '#34d399', mt: 0.5 }}
                          >
                            {formatAmount(p.price)}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Grid>

              {/* Demo Cart Inspector */}
              <Grid item xs={12} md={5}>
                <Paper
                  sx={{
                    p: 2.5,
                    backgroundColor: 'rgba(7, 9, 14, 0.8)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#f8fafc', mb: 2 }}>
                    Current Cart ({cart.reduce((a, c) => a + c.qty, 0)} items)
                  </Typography>

                  <Box sx={{ minHeight: '140px', mb: 2 }}>
                    {cart.map((item) => (
                      <Box
                        key={item.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          py: 1,
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#f8fafc' }}>
                            {item.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                            {formatAmount(item.price)} x {item.qty}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, color: '#34d399' }}>
                            {formatAmount(item.price * item.qty)}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => removeFromCart(item.id)}
                            sx={{ color: '#ef4444' }}
                          >
                            <RemoveCircleOutlineIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Box>

                  <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                      Subtotal
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 600 }}>
                      {formatAmount(subtotal)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#ffffff' }}>
                      Total Amount
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900, color: '#10b981' }}>
                      {formatAmount(total)}
                    </Typography>
                  </Box>

                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => navigate('/pos')}
                    sx={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      fontWeight: 800,
                      py: 1.2,
                      borderRadius: '10px',
                    }}
                  >
                    Simulate Checkout Transaction
                  </Button>
                </Paper>
              </Grid>
            </Grid>
          </Card>
        </Box>
      </Container>

      {/* Feature Showcase Grid */}
      <Box
        id="features"
        sx={{
          py: 10,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography
              variant="overline"
              sx={{ color: '#8b5cf6', fontWeight: 800, letterSpacing: '0.1em' }}
            >
              BUILT FOR SCALABLE ENTERPRISE RETAIL
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 800, color: '#f8fafc', mt: 1 }}>
              Everything Your Operations Team Needs
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {[
              {
                icon: <PointOfSaleIcon sx={{ fontSize: 36, color: '#8b5cf6' }} />,
                title: 'High-Speed POS Terminal',
                desc: 'Sub-second barcode lookup, offline transaction caching, multi-tender split payment modes, and instant thermal receipt printing.',
              },
              {
                icon: <InventoryIcon sx={{ fontSize: 36, color: '#10b981' }} />,
                title: 'Multi-Warehouse Inventory',
                desc: 'Real-time stock level synchronization across physical branches, batch expiry tracking, and automated inter-branch transfer orders.',
              },
              {
                icon: <AutoAwesomeIcon sx={{ fontSize: 36, color: '#38bdf8' }} />,
                title: 'AI Reorder Intelligence',
                desc: 'Predictive machine learning algorithms analyze historical sales patterns to generate optimal stock purchase recommendations.',
              },
              {
                icon: <SignalCellularAltIcon sx={{ fontSize: 36, color: '#fbbf24' }} />,
                title: 'Real-time Telemetry Analytics',
                desc: 'Live financial metrics, gross margin tracking, tax compliance reporting, and sales leaderboards powered by Socket.IO.',
              },
              {
                icon: <StorefrontIcon sx={{ fontSize: 36, color: '#f43f5e' }} />,
                title: 'Omnichannel Integration',
                desc: 'Native integrations with Paystack, Stripe, QuickBooks, and Xero ERP for seamless financial reconciliation.',
              },
              {
                icon: <SecurityIcon sx={{ fontSize: 36, color: '#a855f7' }} />,
                title: 'Enterprise RBAC & Security',
                desc: 'OWASP-compliant JWT session security, granular role-based access permissions, audit logs, and SOC2 readiness.',
              },
            ].map((f, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Card className="glass-panel" sx={{ height: '100%', p: 3, borderRadius: '16px' }}>
                  <Box sx={{ mb: 2 }}>{f.icon}</Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#f8fafc', mb: 1 }}>
                    {f.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9ca3af', lineHeight: 1.6 }}>
                    {f.desc}
                  </Typography>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ROI & Stats Section */}
      <Box id="roi" sx={{ py: 10 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography
                variant="overline"
                sx={{ color: '#10b981', fontWeight: 800, letterSpacing: '0.1em' }}
              >
                MEASURABLE ROI & PERFORMANCE
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 900, color: '#f8fafc', mt: 1, mb: 3 }}>
                Powering Modern Retail & Wholesale Leaders
              </Typography>
              <Typography variant="body1" sx={{ color: '#9ca3af', mb: 4, lineHeight: 1.7 }}>
                Stockora Enterprise replaces fragmented legacy systems with a single unified source
                of truth. Eliminate stockouts, accelerate checkout throughput by 4x, and gain
                instant visibility into profit margins across all your branches.
              </Typography>

              <Box sx={{ display: 'flex', flexColumn: 'column', gap: 2 }}>
                {[
                  'Zero downtime during network outages with offline IndexedDB sync.',
                  'Automated low-stock WebSocket notifications delivered directly to managers.',
                  'Built-in support for barcode scanners, thermal printers, and cash drawers.',
                ].map((text, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <CheckCircleIcon sx={{ color: '#10b981', fontSize: 20 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#e2e8f0' }}>
                      {text}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Grid container spacing={2}>
                {[
                  { metric: '99.99%', label: 'Uptime SLA' },
                  { metric: '4x', label: 'Faster POS Checkout' },
                  { metric: '35%', label: 'Reduced Stock Waste' },
                  { metric: '500k+', label: 'Daily Transactions' },
                ].map((s, idx) => (
                  <Grid item xs={6} key={idx}>
                    <Paper
                      sx={{
                        p: 4,
                        textAlign: 'center',
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        borderRadius: '20px',
                      }}
                    >
                      <Typography variant="h3" sx={{ fontWeight: 900, color: '#34d399', mb: 0.5 }}>
                        {s.metric}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#9ca3af' }}>
                        {s.label}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Pricing Section */}
      <Box
        id="pricing"
        sx={{
          py: 10,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography
              variant="overline"
              sx={{ color: '#8b5cf6', fontWeight: 800, letterSpacing: '0.1em' }}
            >
              TRANSPARENT PRICING
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 800, color: '#f8fafc', mt: 1 }}>
              Scalable Plans For Every Growth Stage
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {[
              {
                title: 'Starter',
                price: '$49',
                desc: 'Perfect for single-location retail stores and pop-up shops.',
                features: [
                  '1 POS Terminal',
                  'Up to 1,000 SKUs',
                  'Offline Sync Mode',
                  'Basic Inventory Reports',
                ],
                buttonText: 'Start Free Trial',
                highlight: false,
              },
              {
                title: 'Growth Enterprise',
                price: '$149',
                desc: 'Designed for expanding multi-branch businesses.',
                features: [
                  '5 POS Terminals',
                  'Unlimited SKUs',
                  'AI Demand Forecasting',
                  'Multi-Warehouse Transfers',
                  'Paystack & Stripe Integration',
                ],
                buttonText: 'Get Started Now',
                highlight: true,
              },
              {
                title: 'Custom Enterprise',
                price: 'Custom',
                desc: 'Tailored solutions for large franchises and logistics hubs.',
                features: [
                  'Unlimited POS Terminals',
                  'Dedicated Account Manager',
                  'Custom ERP Connectors (SAP/Xero)',
                  'Custom SLA & 24/7 Phone Support',
                ],
                buttonText: 'Contact Enterprise Sales',
                highlight: false,
              },
            ].map((plan, idx) => (
              <Grid item xs={12} md={4} key={idx}>
                <Card
                  className="glass-panel"
                  sx={{
                    p: 4,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderRadius: '20px',
                    borderColor: plan.highlight ? '#8b5cf6 !important' : 'rgba(255,255,255,0.08)',
                    boxShadow: plan.highlight
                      ? '0 12px 40px rgba(139, 92, 246, 0.3) !important'
                      : 'none',
                    position: 'relative',
                  }}
                >
                  {plan.highlight && (
                    <Chip
                      label="MOST POPULAR"
                      color="primary"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        fontWeight: 800,
                        fontSize: '0.7rem',
                      }}
                    />
                  )}

                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#f8fafc', mb: 1 }}>
                      {plan.title}
                    </Typography>
                    <Typography
                      variant="h3"
                      sx={{ fontWeight: 900, color: plan.highlight ? '#34d399' : '#ffffff', mb: 1 }}
                    >
                      {plan.price}
                      {plan.price !== 'Custom' && (
                        <Typography component="span" variant="body2" sx={{ color: '#9ca3af' }}>
                          /month
                        </Typography>
                      )}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#9ca3af', mb: 3 }}>
                      {plan.desc}
                    </Typography>
                    <Divider sx={{ mb: 3, borderColor: 'rgba(255,255,255,0.08)' }} />

                    <Box sx={{ mb: 4 }}>
                      {plan.features.map((feat, fIdx) => (
                        <Box
                          key={fIdx}
                          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}
                        >
                          <CheckCircleIcon
                            sx={{ color: plan.highlight ? '#34d399' : '#8b5cf6', fontSize: 18 }}
                          />
                          <Typography variant="body2" sx={{ color: '#e2e8f0', fontWeight: 500 }}>
                            {feat}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>

                  <Button
                    fullWidth
                    variant={plan.highlight ? 'contained' : 'outlined'}
                    onClick={() => navigate('/signup')}
                    sx={{
                      py: 1.4,
                      fontWeight: 800,
                      borderRadius: '12px',
                      background: plan.highlight
                        ? 'linear-gradient(135deg, #8b5cf6 0%, #10b981 100%)'
                        : 'transparent',
                    }}
                  >
                    {plan.buttonText}
                  </Button>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        sx={{ py: 6, backgroundColor: '#030712', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Typography variant="body2" sx={{ color: '#6b7280' }}>
              © {new Date().getFullYear()} Stockora Enterprise Inc. All rights reserved.
            </Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Button
                onClick={() => navigate('/login')}
                sx={{ color: '#9ca3af', fontSize: '0.85rem' }}
              >
                Login
              </Button>
              <Button
                onClick={() => navigate('/signup')}
                sx={{ color: '#9ca3af', fontSize: '0.85rem' }}
              >
                Create Account
              </Button>
              <Button
                onClick={() => navigate('/pos')}
                sx={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 700 }}
              >
                POS Terminal
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default LandingPage;
