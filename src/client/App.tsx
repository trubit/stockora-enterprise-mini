import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { ConfirmDialogProvider } from './context/ConfirmDialogContext.tsx';
import { setAppNavigator } from './utils/navigation.ts';
import Layout from './components/Layout.tsx';
import Dashboard from './pages/Dashboard.tsx';
import POS from './pages/POS.tsx';
import Inventory from './pages/Inventory.tsx';
import { socket } from './socket.ts';
import SignIn from './pages/auth/SignIn.tsx';
import SignUp from './pages/auth/SignUp.tsx';
import ForgotPassword from './pages/auth/ForgotPassword.tsx';
import ResetPassword from './pages/auth/ResetPassword.tsx';
import VerifyEmail from './pages/auth/VerifyEmail.tsx';
import AcceptInvitation from './pages/auth/AcceptInvitation.tsx';
import AccessDenied from './pages/auth/AccessDenied.tsx';
import SessionExpired from './pages/auth/SessionExpired.tsx';
import Profile from './pages/auth/Profile.tsx';
import CompanySettings from './pages/admin/CompanySettings.tsx';
import { CompanySettingsPage } from './pages/tenant/CompanySettingsPage.tsx';
import { RegionalSettingsConsole } from './pages/tenant/RegionalSettingsConsole.tsx';
import { TenantOnboardingWizard } from './pages/tenant/TenantOnboardingWizard.tsx';
import { PlatformAdminDashboard } from './pages/admin/PlatformAdminDashboard.tsx';
import PricingPage from './pages/billing/PricingPage.tsx';
import BillingDashboard from './pages/billing/BillingDashboard.tsx';
import UsageDashboard from './pages/billing/UsageDashboard.tsx';
import PlatformBillingAdmin from './pages/admin/PlatformBillingAdmin.tsx';
import IntegrationHub from './pages/integrations/IntegrationHub.tsx';
import ApiKeyManager from './pages/integrations/ApiKeyManager.tsx';
import WebhookManager from './pages/integrations/WebhookManager.tsx';
import DataImportWizard from './pages/integrations/DataImportWizard.tsx';
import DataExportCenter from './pages/integrations/DataExportCenter.tsx';

import BranchList from './pages/admin/BranchList.tsx';
import MasterDataList from './pages/admin/MasterDataList.tsx';
import ProductCatalog from './pages/admin/ProductCatalog.tsx';
import Suppliers from './pages/admin/Suppliers.tsx';
import Customers from './pages/admin/Customers.tsx';
import StockAdjustments from './pages/admin/StockAdjustments.tsx';
import WarehouseTransfers from './pages/admin/WarehouseTransfers.tsx';
import PurchaseOrders from './pages/admin/PurchaseOrders.tsx';
import ReceivingLogistics from './pages/admin/ReceivingLogistics.tsx';
import SalesBackOffice from './pages/admin/SalesBackOffice.tsx';
import ReturnsLogistics from './pages/admin/ReturnsLogistics.tsx';
import MarketingManager from './pages/admin/MarketingManager.tsx';
import CommunicationCenter from './pages/admin/CommunicationCenter.tsx';
import SchedulerMonitor from './pages/admin/SchedulerMonitor.tsx';
import AdminConsole from './pages/admin/AdminConsole.tsx';
import FinancialReports from './pages/admin/FinancialReports.tsx';
import OfflineSyncMonitor from './pages/admin/OfflineSyncMonitor.tsx';
import CurrencySettings from './pages/admin/CurrencySettings.tsx';
import HardwareControl from './pages/admin/HardwareControl.tsx';
import IntegrationManager from './pages/admin/IntegrationManager.tsx';
import WarehouseVisualizer from './pages/admin/WarehouseVisualizer.tsx';
import ExecutiveDashboard from './pages/admin/ExecutiveDashboard.tsx';
import ReportBuilder from './pages/admin/ReportBuilder.tsx';
import SavedReports from './pages/admin/SavedReports.tsx';
import ScheduledReports from './pages/admin/ScheduledReports.tsx';
import AnalyticsDashboard from './pages/admin/AnalyticsDashboard.tsx';
import ExportCenter from './pages/admin/ExportCenter.tsx';
import WorkflowDesigner from './pages/admin/WorkflowDesigner.tsx';
import WorkflowHistory from './pages/admin/WorkflowHistory.tsx';
import ApprovalConsole from './pages/admin/ApprovalConsole.tsx';
import OperationsCenter from './pages/admin/OperationsCenter.tsx';
import AuditExplorer from './pages/admin/AuditExplorer.tsx';
import AICopilot from './pages/admin/AICopilot.tsx';
import AICopilotAdmin from './pages/admin/AICopilotAdmin.tsx';
import AIIntelligenceConsole from './pages/analytics/AIIntelligenceConsole.tsx';
import InventoryIntelligenceDashboard from './pages/inventory/InventoryIntelligenceDashboard.tsx';
import DemandForecasting from './pages/inventory/DemandForecasting.tsx';
import ReorderRecommendations from './pages/inventory/ReorderRecommendations.tsx';
import SupplierIntelligence from './pages/inventory/SupplierIntelligence.tsx';
import StockOptimization from './pages/inventory/StockOptimization.tsx';
import CRMDashboard from './pages/crm/CRMDashboard.tsx';
import Customer360 from './pages/crm/Customer360.tsx';
import CustomerSegments from './pages/crm/CustomerSegments.tsx';
import CampaignManager from './pages/crm/CampaignManager.tsx';
import LoyaltyDashboard from './pages/crm/LoyaltyDashboard.tsx';
import CouponsPromotions from './pages/crm/CouponsPromotions.tsx';
import CustomerRetention from './pages/crm/CustomerRetention.tsx';
import CustomerJourneys from './pages/crm/CustomerJourneys.tsx';
import POSTerminal from './pages/pos/POSTerminal.tsx';
import RegisterSessionManager from './pages/pos/RegisterSessionManager.tsx';
import OmnichannelOrderManagement from './pages/orders/OmnichannelOrderManagement.tsx';
import OrderFulfillmentManager from './pages/orders/OrderFulfillmentManager.tsx';
import ReturnsRefundsManager from './pages/orders/ReturnsRefundsManager.tsx';
import FinanceDashboard from './pages/finance/FinanceDashboard.tsx';
import ChartOfAccountsManager from './pages/finance/ChartOfAccountsManager.tsx';
import JournalEntryConsole from './pages/finance/JournalEntryConsole.tsx';
import GeneralLedgerView from './pages/finance/GeneralLedgerView.tsx';
import FinancialStatementsView from './pages/finance/FinancialStatementsView.tsx';
import ExpenseManager from './pages/finance/ExpenseManager.tsx';
import ARAPManagement from './pages/finance/ARAPManagement.tsx';
import BankReconciliationConsole from './pages/finance/BankReconciliationConsole.tsx';
import TaxManagementConsole from './pages/finance/TaxManagementConsole.tsx';
import FiscalPeriodManager from './pages/finance/FiscalPeriodManager.tsx';
import BudgetingConsole from './pages/finance/BudgetingConsole.tsx';
import ProcurementDashboard from './pages/procurement/ProcurementDashboard.tsx';
import SupplierManager from './pages/procurement/SupplierManager.tsx';
import SupplierProfileManager from './pages/procurement/SupplierProfileManager.tsx';
import PurchaseRequestWorkflowConsole from './pages/procurement/PurchaseRequestWorkflowConsole.tsx';
import PurchaseOrderVersionConsole from './pages/procurement/PurchaseOrderVersionConsole.tsx';
import GoodsReceivingConsole from './pages/procurement/GoodsReceivingConsole.tsx';
import SupplierReturnsManager from './pages/procurement/SupplierReturnsManager.tsx';
import ThreeWayMatchingConsole from './pages/procurement/ThreeWayMatchingConsole.tsx';
import ProcurementAnalyticsDashboard from './pages/procurement/ProcurementAnalyticsDashboard.tsx';
import SupplierProductManager from './pages/procurement/SupplierProductManager.tsx';
import QualityInspectionConsole from './pages/procurement/QualityInspectionConsole.tsx';
import AutomatedReplenishmentConsole from './pages/procurement/AutomatedReplenishmentConsole.tsx';
import SupplierComparisonConsole from './pages/procurement/SupplierComparisonConsole.tsx';
import LandedCostConsole from './pages/procurement/LandedCostConsole.tsx';
import ProcurementBudgetManager from './pages/procurement/ProcurementBudgetManager.tsx';
import ProcurementSettings from './pages/procurement/ProcurementSettings.tsx';
import WarehouseDashboard from './pages/warehouse/WarehouseDashboard.tsx';
import WarehouseManager from './pages/warehouse/WarehouseManager.tsx';
import WarehouseLocationManager from './pages/warehouse/WarehouseLocationManager.tsx';
import StockTransferConsole from './pages/warehouse/StockTransferConsole.tsx';
import PutAwayConsole from './pages/warehouse/PutAwayConsole.tsx';
import PickingConsole from './pages/warehouse/PickingConsole.tsx';
import WavePickingConsole from './pages/warehouse/WavePickingConsole.tsx';
import PackingStationConsole from './pages/warehouse/PackingStationConsole.tsx';
import DispatchConsole from './pages/warehouse/DispatchConsole.tsx';
import PackageManifestConsole from './pages/warehouse/PackageManifestConsole.tsx';
import CycleCountConsole from './pages/warehouse/CycleCountConsole.tsx';
import StockCountReconciliationConsole from './pages/warehouse/StockCountReconciliationConsole.tsx';
import InventoryExceptionsManager from './pages/warehouse/InventoryExceptionsManager.tsx';
import WarehouseAnalyticsDashboard from './pages/warehouse/WarehouseAnalyticsDashboard.tsx';
import WarehouseSettings from './pages/warehouse/WarehouseSettings.tsx';
import SalesAnalyticsDashboard from './pages/sales/SalesAnalyticsDashboard.tsx';
import OmnichannelOrderBuilder from './pages/sales/OmnichannelOrderBuilder.tsx';
import SalesQuoteConsole from './pages/sales/SalesQuoteConsole.tsx';
import PriceListManager from './pages/sales/PriceListManager.tsx';
import SalesChannelConsole from './pages/sales/SalesChannelConsole.tsx';
import SalesRepsTerritories from './pages/sales/SalesRepsTerritories.tsx';
import POSTerminalConsole from './pages/pos/POSTerminalConsole.tsx';
import RegisterSessionConsole from './pages/pos/RegisterSessionConsole.tsx';
import HeldSalesConsole from './pages/pos/HeldSalesConsole.tsx';
import OmnichannelSalesConsole from './pages/commerce/OmnichannelSalesConsole.tsx';
import SalesReturnRefundConsole from './pages/commerce/SalesReturnRefundConsole.tsx';
import CommerceAnalyticsDashboard from './pages/commerce/CommerceAnalyticsDashboard.tsx';
import LandingPage from './pages/LandingPage.tsx';
import SalesAnalyticsView from './pages/analytics/SalesAnalyticsView.tsx';
import InventoryAnalyticsView from './pages/analytics/InventoryAnalyticsView.tsx';
import CustomerAnalyticsView from './pages/analytics/CustomerAnalyticsView.tsx';
import SupplierAnalyticsView from './pages/analytics/SupplierAnalyticsView.tsx';
import FinancialAnalyticsView from './pages/analytics/FinancialAnalyticsView.tsx';
import ForecastAnalyticsView from './pages/analytics/ForecastAnalyticsView.tsx';
import AnomalyIntelligenceView from './pages/analytics/AnomalyIntelligenceView.tsx';
import KPIDashboardView from './pages/analytics/KPIDashboardView.tsx';
import { ProtectedRoute } from './routes/ProtectedRoute.tsx';

function NavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    setAppNavigator(navigate);
  }, [navigate]);
  return null;
}

function App() {
  useEffect(() => {
    // Standard WebSocket alerts for enterprise inventory monitoring (SRE/Reliability guidelines)
    socket.on('notification:low-stock', (data: { name: string; quantity: number }) => {
      toast.error(`Low Stock Warning: ${data.name} is down to ${data.quantity} units!`, {
        duration: 5000,
        position: 'top-right',
        style: {
          background: '#1f2937',
          color: '#f59e0b',
          border: '1px solid #f59e0b',
        },
      });
    });

    socket.on('product:created', (data: { name: string }) => {
      toast.success(`New product catalog addition: "${data.name}"`, {
        position: 'bottom-right',
      });
    });

    return () => {
      socket.off('connect');
      socket.off('notification:low-stock');
      socket.off('product:created');
    };
  }, []);

  return (
    <BrowserRouter>
      <NavigationBridge />
      {/* Toast Notification Provider */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(17, 24, 39, 0.95)',
            color: '#f3f4f6',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            borderRadius: '10px',
            fontSize: '0.875rem',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
            padding: '12px 16px',
            maxWidth: '420px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#111827',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#111827',
            },
          },
        }}
      />
      <ConfirmDialogProvider>
        <Routes>
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/invitations/accept/:token" element={<AcceptInvitation />} />
          <Route path="/invitations/accept" element={<AcceptInvitation />} />
          <Route path="/session-expired" element={<SessionExpired />} />
          <Route path="/access-denied" element={<AccessDenied />} />

          <Route path="/" element={<Layout />}>
            {/* Publicly accessible to all authenticated users */}
            <Route element={<ProtectedRoute />}>
              <Route index element={<Dashboard />} />
              <Route path="profile" element={<Profile />} />
              <Route path="ai/intelligence" element={<AIIntelligenceConsole />} />
              <Route path="ai" element={<AIIntelligenceConsole />} />
              <Route path="copilot/chat" element={<AICopilot />} />
              <Route path="offline-sync" element={<OfflineSyncMonitor />} />
            </Route>

            {/* POS Terminal & Register Manager */}
            <Route element={<ProtectedRoute requiredPermission="transactions:write" />}>
              <Route path="pos" element={<POS />} />
              <Route path="pos/terminal" element={<POSTerminal />} />
              <Route path="pos/register" element={<RegisterSessionManager />} />
            </Route>

            {/* Products & Inventory Catalog */}
            <Route element={<ProtectedRoute requiredPermission="products:read" />}>
              <Route path="products" element={<ProductCatalog />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="inventory/intelligence" element={<InventoryIntelligenceDashboard />} />
              <Route path="inventory/forecasting" element={<DemandForecasting />} />
              <Route path="inventory/reorder" element={<ReorderRecommendations />} />
              <Route path="inventory/suppliers" element={<SupplierIntelligence />} />
              <Route path="inventory/optimization" element={<StockOptimization />} />
              <Route path="transfers" element={<WarehouseTransfers />} />
              <Route path="receiving" element={<ReceivingLogistics />} />
            </Route>

            {/* Stock Adjustments */}
            <Route element={<ProtectedRoute requiredPermission="products:write" />}>
              <Route path="adjustments" element={<StockAdjustments />} />
            </Route>

            {/* Suppliers Directory */}
            <Route element={<ProtectedRoute requiredPermission="suppliers:read" />}>
              <Route path="purchase-orders" element={<PurchaseOrders />} />
              <Route path="suppliers" element={<Suppliers />} />
            </Route>

            {/* Customers Directory & Enterprise CRM */}
            <Route element={<ProtectedRoute requiredPermission="customers:read" />}>
              <Route path="customers" element={<Customers />} />
              <Route path="crm" element={<CRMDashboard />} />
              <Route path="crm/dashboard" element={<CRMDashboard />} />
              <Route path="crm/customer360" element={<Customer360 />} />
              <Route path="crm/customers/:id" element={<Customer360 />} />
              <Route path="crm/segments" element={<CustomerSegments />} />
              <Route path="crm/campaigns" element={<CampaignManager />} />
              <Route path="crm/loyalty" element={<LoyaltyDashboard />} />
              <Route path="crm/coupons" element={<CouponsPromotions />} />
              <Route path="crm/retention" element={<CustomerRetention />} />
              <Route path="crm/journeys" element={<CustomerJourneys />} />
            </Route>

            {/* Sales & Omnichannel Order Management */}
            <Route element={<ProtectedRoute requiredPermission="transactions:read" />}>
              <Route path="sales" element={<SalesBackOffice />} />
              <Route path="orders/omnichannel" element={<OmnichannelOrderManagement />} />
              <Route path="orders/fulfillment" element={<OrderFulfillmentManager />} />
              <Route path="orders/returns" element={<ReturnsRefundsManager />} />
            </Route>

            {/* Sales Returns */}
            <Route element={<ProtectedRoute requiredPermission="returns:read" />}>
              <Route path="returns" element={<ReturnsLogistics />} />
            </Route>

            {/* Marketing & Loyalty Campaigns */}
            <Route element={<ProtectedRoute requiredPermission="promotions:read" />}>
              <Route path="marketing" element={<MarketingManager />} />
              <Route path="crm/campaigns" element={<CampaignManager />} />
              <Route path="crm/coupons" element={<CouponsPromotions />} />
            </Route>

            {/* Communication Center */}
            <Route element={<ProtectedRoute requiredPermission="notifications:read" />}>
              <Route path="communication" element={<CommunicationCenter />} />
            </Route>

            {/* Finance & Currency Settings */}
            <Route element={<ProtectedRoute requiredPermission="finance:read" />}>
              <Route path="finance" element={<FinancialReports />} />
              <Route path="finance/dashboard" element={<FinanceDashboard />} />
              <Route path="finance/accounts" element={<ChartOfAccountsManager />} />
              <Route path="finance/journals" element={<JournalEntryConsole />} />
              <Route path="finance/ledger" element={<GeneralLedgerView />} />
              <Route path="finance/statements" element={<FinancialStatementsView />} />
              <Route path="finance/expenses" element={<ExpenseManager />} />
              <Route path="finance/ar-ap" element={<ARAPManagement />} />
              <Route path="finance/banking" element={<BankReconciliationConsole />} />
              <Route path="finance/tax" element={<TaxManagementConsole />} />
              <Route path="finance/periods" element={<FiscalPeriodManager />} />
              <Route path="finance/budgets" element={<BudgetingConsole />} />
              <Route path="currency" element={<CurrencySettings />} />
            </Route>

            {/* Executive & Analytics Reporting */}
            <Route element={<ProtectedRoute requiredPermission="reports:read" />}>
              <Route path="reports/executive" element={<ExecutiveDashboard />} />
              <Route path="company/analytics/executive" element={<ExecutiveDashboard />} />
              <Route path="company/analytics/sales" element={<SalesAnalyticsView />} />
              <Route path="company/analytics/inventory" element={<InventoryAnalyticsView />} />
              <Route path="company/analytics/customers" element={<CustomerAnalyticsView />} />
              <Route path="company/analytics/suppliers" element={<SupplierAnalyticsView />} />
              <Route path="company/analytics/finance" element={<FinancialAnalyticsView />} />
              <Route path="company/analytics/forecast" element={<ForecastAnalyticsView />} />
              <Route path="company/analytics/anomalies" element={<AnomalyIntelligenceView />} />
              <Route path="company/analytics/kpis" element={<KPIDashboardView />} />
              <Route path="reports/builder" element={<ReportBuilder />} />
              <Route path="reports/saved" element={<SavedReports />} />
              <Route path="reports/scheduled" element={<ScheduledReports />} />
              <Route path="reports/kpis" element={<KPIDashboardView />} />
              <Route path="reports/analytics" element={<AnalyticsDashboard />} />
              <Route path="reports/exports" element={<ExportCenter />} />
            </Route>

            {/* AI Copilot Admin Settings */}
            <Route element={<ProtectedRoute requiredPermission="security:write" />}>
              <Route path="copilot/settings" element={<AICopilotAdmin />} />
            </Route>

            {/* Workflow Designer */}
            <Route element={<ProtectedRoute requiredPermission="workflows:write" />}>
              <Route path="workflows/designer" element={<WorkflowDesigner />} />
            </Route>

            {/* Workflow History & Approvals */}
            <Route element={<ProtectedRoute requiredPermission="workflows:read" />}>
              <Route path="workflows/history" element={<WorkflowHistory />} />
              <Route path="workflows/approvals" element={<ApprovalConsole />} />
            </Route>

            {/* Operations & Hardware Administration */}
            <Route element={<ProtectedRoute requiredPermission="security:read" />}>
              <Route path="observability/operations" element={<OperationsCenter />} />
              <Route path="hardware" element={<HardwareControl />} />
              <Route path="integrations" element={<IntegrationManager />} />
            </Route>

            {/* Audit Logs */}
            <Route element={<ProtectedRoute requiredPermission="audit:read" />}>
              <Route path="observability/audit" element={<AuditExplorer />} />
            </Route>

            {/* Tenant Company Profiles & Multi-Tenant SaaS Management */}
            <Route element={<ProtectedRoute requiredPermission="companies:read" />}>
              <Route path="company" element={<CompanySettings />} />
              <Route path="company/settings" element={<CompanySettingsPage />} />
              <Route path="company/settings/regional" element={<RegionalSettingsConsole />} />
              <Route path="settings/regional" element={<RegionalSettingsConsole />} />
              <Route path="onboarding" element={<TenantOnboardingWizard />} />
            </Route>

            {/* Platform Super Administrator Console */}
            <Route element={<ProtectedRoute requirePlatformAdmin={true} />}>
              <Route path="admin/platform" element={<PlatformAdminDashboard />} />
              <Route path="console" element={<AdminConsole />} />
            </Route>

            {/* Branches List */}
            <Route element={<ProtectedRoute requiredPermission="branches:read" />}>
              <Route path="branches" element={<BranchList />} />
            </Route>

            {/* Warehouse Visualizer */}
            <Route element={<ProtectedRoute requiredPermission="warehouses:read" />}>
              <Route path="warehouse-visualizer" element={<WarehouseVisualizer />} />
            </Route>

            {/* Master Data */}
            <Route element={<ProtectedRoute requiredPermission="master_data:read" />}>
              <Route path="master-data" element={<MasterDataList />} />
            </Route>

            {/* Scheduler Monitor */}
            <Route element={<ProtectedRoute requiredPermission="automation:read" />}>
              <Route path="scheduler" element={<SchedulerMonitor />} />
            </Route>

            {/* Phase 38 — Advanced Procurement, Supplier Management & Automated Replenishment Routes */}
            <Route element={<ProtectedRoute requiredPermission="suppliers:read" />}>
              <Route path="procurement" element={<ProcurementDashboard />} />
              <Route path="procurement/dashboard" element={<ProcurementDashboard />} />
              <Route path="procurement/suppliers" element={<SupplierManager />} />
              <Route path="procurement/suppliers/:id" element={<SupplierProfileManager />} />
              <Route
                path="procurement/suppliers/:id/profile"
                element={<SupplierProfileManager />}
              />
              <Route
                path="procurement/suppliers/:id/products"
                element={<SupplierProductManager />}
              />
              <Route
                path="procurement/suppliers/:id/performance"
                element={<SupplierProfileManager />}
              />
              <Route path="procurement/products" element={<SupplierProductManager />} />
              <Route path="procurement/requests" element={<PurchaseRequestWorkflowConsole />} />
              <Route path="procurement/requests/:id" element={<PurchaseRequestWorkflowConsole />} />
              <Route path="procurement/purchase-orders" element={<PurchaseOrderVersionConsole />} />
              <Route
                path="procurement/purchase-orders/:id"
                element={<PurchaseOrderVersionConsole />}
              />
              <Route path="procurement/replenishment" element={<AutomatedReplenishmentConsole />} />
              <Route
                path="procurement/replenishment/:id"
                element={<AutomatedReplenishmentConsole />}
              />
              <Route
                path="procurement/supplier-comparison"
                element={<SupplierComparisonConsole />}
              />
              <Route path="procurement/landed-cost" element={<LandedCostConsole />} />
              <Route path="procurement/budgets" element={<ProcurementBudgetManager />} />
              <Route path="procurement/receiving" element={<GoodsReceivingConsole />} />
              <Route path="procurement/receiving/:id" element={<GoodsReceivingConsole />} />
              <Route path="procurement/inspections" element={<QualityInspectionConsole />} />
              <Route path="procurement/returns" element={<SupplierReturnsManager />} />
              <Route path="procurement/invoices" element={<ThreeWayMatchingConsole />} />
              <Route path="procurement/exceptions" element={<ThreeWayMatchingConsole />} />
              <Route path="procurement/three-way-matching" element={<ThreeWayMatchingConsole />} />
              <Route path="procurement/analytics" element={<ProcurementAnalyticsDashboard />} />
              <Route path="procurement/settings" element={<ProcurementSettings />} />
            </Route>

            {/* Phase 37 — Advanced Warehouse Operations & Logistics Engine Routes */}
            <Route element={<ProtectedRoute requiredPermission="warehouses:read" />}>
              <Route path="warehouse" element={<WarehouseDashboard />} />
              <Route path="warehouse/dashboard" element={<WarehouseDashboard />} />
              <Route path="warehouse/warehouses" element={<WarehouseManager />} />
              <Route path="warehouse/warehouses/:id" element={<WarehouseManager />} />
              <Route path="warehouse/locations" element={<WarehouseLocationManager />} />
              <Route path="warehouse/transfers" element={<StockTransferConsole />} />
              <Route path="warehouse/transfers/:id" element={<StockTransferConsole />} />
              <Route path="warehouse/putaway" element={<PutAwayConsole />} />
              <Route path="warehouse/picking" element={<PickingConsole />} />
              <Route path="warehouse/picking/:id" element={<PickingConsole />} />
              <Route path="warehouse/waves" element={<WavePickingConsole />} />
              <Route path="warehouse/packing" element={<PackingStationConsole />} />
              <Route path="warehouse/packing/:id" element={<PackingStationConsole />} />
              <Route path="warehouse/dispatch" element={<DispatchConsole />} />
              <Route path="warehouse/manifests" element={<PackageManifestConsole />} />
              <Route path="warehouse/cycle-count" element={<CycleCountConsole />} />
              <Route path="warehouse/counting" element={<StockCountReconciliationConsole />} />
              <Route path="warehouse/counts" element={<StockCountReconciliationConsole />} />
              <Route path="warehouse/counts/:id" element={<StockCountReconciliationConsole />} />
              <Route
                path="warehouse/reconciliation"
                element={<StockCountReconciliationConsole />}
              />
              <Route path="warehouse/exceptions" element={<InventoryExceptionsManager />} />
              <Route path="warehouse/analytics" element={<WarehouseAnalyticsDashboard />} />
              <Route path="warehouse/settings" element={<WarehouseSettings />} />
            </Route>

            {/* Phase 35 & 39 — Sales & Commerce Routes */}
            <Route element={<ProtectedRoute requiredPermission="transactions:read" />}>
              <Route path="sales" element={<SalesAnalyticsDashboard />} />
              <Route path="sales/analytics" element={<SalesAnalyticsDashboard />} />
              <Route path="sales/builder" element={<OmnichannelOrderBuilder />} />
              <Route path="sales/quotes" element={<SalesQuoteConsole />} />
              <Route path="sales/price-lists" element={<PriceListManager />} />
              <Route path="sales/channels" element={<SalesChannelConsole />} />
              <Route path="sales/territories" element={<SalesRepsTerritories />} />
              <Route path="commerce" element={<CommerceAnalyticsDashboard />} />
              <Route path="commerce/dashboard" element={<CommerceAnalyticsDashboard />} />
              <Route path="commerce/orders" element={<OmnichannelSalesConsole />} />
              <Route path="commerce/returns" element={<SalesReturnRefundConsole />} />
              <Route path="commerce/refunds" element={<SalesReturnRefundConsole />} />
              <Route path="commerce/analytics" element={<CommerceAnalyticsDashboard />} />
            </Route>

            {/* Phase 39 — Advanced POS Routes */}
            <Route element={<ProtectedRoute requiredPermission="transactions:write" />}>
              <Route path="pos/console" element={<POSTerminalConsole />} />
              <Route path="pos/register-console" element={<RegisterSessionConsole />} />
              <Route path="pos/held-sales" element={<HeldSalesConsole />} />
            </Route>

            {/* Phase 41 — Advanced Financial Management, Accounting & Cashflow Routes */}
            <Route element={<ProtectedRoute requiredPermission="finance:read" />}>
              <Route path="finance" element={<FinanceDashboard />} />
              <Route path="finance/dashboard" element={<FinanceDashboard />} />
              <Route path="finance/accounts" element={<ChartOfAccountsManager />} />
              <Route path="finance/journals" element={<JournalEntryConsole />} />
              <Route path="finance/ledger" element={<GeneralLedgerView />} />
              <Route path="finance/statements" element={<FinancialStatementsView />} />
              <Route path="finance/reports" element={<FinancialStatementsView />} />
              <Route path="finance/expenses" element={<ExpenseManager />} />
              <Route path="finance/ar-ap" element={<ARAPManagement />} />
              <Route path="finance/receivables" element={<ARAPManagement />} />
              <Route path="finance/payables" element={<ARAPManagement />} />
              <Route path="finance/banking" element={<BankReconciliationConsole />} />
              <Route path="finance/reconciliation" element={<BankReconciliationConsole />} />
              <Route path="finance/tax" element={<TaxManagementConsole />} />
              <Route path="finance/periods" element={<FiscalPeriodManager />} />
            </Route>

            {/* Phase 44 — Subscription Plans, Usage Limits & SaaS Billing */}
            <Route element={<ProtectedRoute requiredPermission="companies:read" />}>
              <Route path="pricing" element={<PricingPage />} />
              <Route path="company/billing" element={<BillingDashboard />} />
              <Route path="company/usage" element={<UsageDashboard />} />
            </Route>
            <Route element={<ProtectedRoute requirePlatformAdmin={true} />}>
              <Route path="admin/billing" element={<PlatformBillingAdmin />} />
            </Route>

            {/* Phase 45 — Enterprise Integrations, External APIs, Webhooks, Import & Export */}
            <Route element={<ProtectedRoute requiredPermission="security:read" />}>
              <Route path="company/integrations" element={<IntegrationHub />} />
              <Route path="company/developer/api-keys" element={<ApiKeyManager />} />
              <Route path="company/developer/webhooks" element={<WebhookManager />} />
              <Route path="company/import" element={<DataImportWizard />} />
              <Route path="company/export" element={<DataExportCenter />} />
              <Route path="integrations/hub" element={<IntegrationHub />} />
              <Route path="developer/api-keys" element={<ApiKeyManager />} />
              <Route path="developer/webhooks" element={<WebhookManager />} />
              <Route path="data/import" element={<DataImportWizard />} />
              <Route path="data/export" element={<DataExportCenter />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ConfirmDialogProvider>
    </BrowserRouter>
  );
}

export default App;
