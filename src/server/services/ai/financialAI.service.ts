import { FinanceService } from '../finance.service.js';
import { CashManagementService } from '../cashManagement.service.js';
import { CashflowService } from '../cashflow.service.js';
import { AccountsReceivableService } from '../accountsReceivable.service.js';
import { AccountsPayableService } from '../accountsPayable.service.js';
import { logger } from '../../logger.js';
import { ResilientExecutor } from '../../utils/resiliency/index.js';
import { geminiService } from './gemini/gemini.service.js';

export interface WhatIfFinancialScenarioPayload {
  expenseChangePct?: number; // e.g. +10 or -5
  salesChangePct?: number; // e.g. +15 or -10
  priceChangePct?: number; // e.g. +5
  supplierCostChangePct?: number; // e.g. +8
  additionalHeadcount?: number; // e.g. +2 employees
  avgSalaryPerHeadcount?: number; // e.g. 3500/month
  tenantId?: string;
}

export interface WhatIfFinancialResult {
  baseline: {
    netRevenue: number;
    cogs: number;
    operatingExpenses: number;
    operatingProfit: number;
    netMarginPct: number;
    cashRunwayMonths: number;
  };
  simulated: {
    netRevenue: number;
    cogs: number;
    operatingExpenses: number;
    operatingProfit: number;
    netMarginPct: number;
    profitDelta: number;
    profitDeltaPct: number;
    cashRunwayMonths: number;
  };
  aiScenarioAssessment: string;
}

export class FinancialAIService {
  /**
   * 1. Conversational AI Financial Assistant with Live Context Grounding
   */
  public static async queryFinancialAssistant(
    prompt: string,
    tenantId = 'default'
  ): Promise<string> {
    return await ResilientExecutor.execute({ name: 'AI-Financial-Assistant' }, async () => {
      const [pnl, balanceSheet, cashPosition, arAging, apAging, cashflowForecast] =
        await Promise.all([
          FinanceService.getProfitAndLoss(tenantId),
          FinanceService.getBalanceSheet(tenantId),
          CashManagementService.getCashPosition(tenantId),
          AccountsReceivableService.getAgingReport(tenantId),
          AccountsPayableService.getAgingReport(tenantId),
          CashflowService.getCashflowForecast(tenantId),
        ]);

      const financialContext = JSON.stringify({
        liquidCash: cashPosition.totalLiquidCash,
        cashBreakdown: cashPosition.breakdown,
        grossRevenue: pnl.grossRevenue,
        netRevenue: pnl.netRevenue,
        cogs: pnl.cogs,
        grossProfit: pnl.grossProfit,
        grossMarginPct: pnl.grossMarginPercentage,
        operatingExpenses: pnl.totalOperatingExpenses,
        operatingProfit: pnl.operatingProfit,
        netIncome: pnl.netIncome,
        totalAssets: balanceSheet.totalAssets,
        totalLiabilities: balanceSheet.totalLiabilities,
        totalEquity: balanceSheet.totalEquity,
        accountsReceivableOutstanding: arAging.summary.totalOutstanding,
        accountsReceivableOverdue: arAging.summary.days90Plus + arAging.summary.days61_90,
        accountsPayableOutstanding: apAging.summary.totalOutstanding,
        projected30DayCashMovement: cashflowForecast.forecasts[0]?.netCashflowMovement,
        projected30DayClosingCash: cashflowForecast.forecasts[0]?.projectedClosingCash,
      });

      const systemPrompt = `
        You are the Stockora Enterprise Chief Financial Officer (CFO) AI Advisor & Decision Intelligence Engine.
        You strictly cite actual verified facts from the live ledger database provided.
        Never hallucinate, invent, or modify accounting data.
        Provide structured, concise, evidence-backed answers with exact monetary numbers and strategic recommendations.
      `;

      const userFullPrompt = `
        User Question: "${prompt}"

        Live Database Financial Context:
        ${financialContext}

        Provide a clear, accurate, and executive financial answer.
      `;

      try {
        const res = await geminiService.generateContent({
          tenantId: tenantId || 'default',
          action: 'financial_copilot',
          systemInstruction: systemPrompt,
          prompt: userFullPrompt,
          responseMimeType: 'text/plain',
        });
        return res.content;
      } catch (err) {
        logger.error('[FinancialAIService] Assistant prompt failed:', err);
        return `**Executive Financial Summary:** Liquid Cash: $${cashPosition.totalLiquidCash.toLocaleString()} | Net Revenue: $${pnl.netRevenue.toLocaleString()} | Operating Profit: $${pnl.operatingProfit.toLocaleString()} (${pnl.grossMarginPercentage}% margin) | Outstanding AR: $${arAging.summary.totalOutstanding.toLocaleString()} | Outstanding AP: $${apAging.summary.totalOutstanding.toLocaleString()}.`;
      }
    });
  }

  /**
   * 2. What-If Financial Scenario Simulator
   */
  public static async simulateWhatIfScenario(
    payload: WhatIfFinancialScenarioPayload
  ): Promise<WhatIfFinancialResult> {
    const tenantId = payload.tenantId || 'default';
    const [pnl, cashPosition] = await Promise.all([
      FinanceService.getProfitAndLoss(tenantId),
      CashManagementService.getCashPosition(tenantId),
    ]);

    const baseRevenue = pnl.netRevenue || 50000;
    const baseCogs = pnl.cogs || 25000;
    const baseExpenses = pnl.totalOperatingExpenses || 15000;
    const baseProfit = baseRevenue - baseCogs - baseExpenses;
    const baseMargin = baseRevenue > 0 ? (baseProfit / baseRevenue) * 100 : 0;
    const monthlyBurn = (baseCogs + baseExpenses) / 12 || 3000;
    const baseRunway = monthlyBurn > 0 ? cashPosition.totalLiquidCash / monthlyBurn : 12;

    // Apply simulation shifts
    const salesShift = (payload.salesChangePct || 0) / 100;
    const priceShift = (payload.priceChangePct || 0) / 100;
    const expenseShift = (payload.expenseChangePct || 0) / 100;
    const supplierCostShift = (payload.supplierCostChangePct || 0) / 100;
    const extraPayroll =
      (payload.additionalHeadcount || 0) * (payload.avgSalaryPerHeadcount || 3000) * 12;

    const simRevenue = baseRevenue * (1 + salesShift) * (1 + priceShift);
    const simCogs = baseCogs * (1 + supplierCostShift) * (1 + salesShift);
    const simExpenses = baseExpenses * (1 + expenseShift) + extraPayroll;
    const simProfit = simRevenue - simCogs - simExpenses;
    const simMargin = simRevenue > 0 ? (simProfit / simRevenue) * 100 : 0;

    const profitDelta = simProfit - baseProfit;
    const profitDeltaPct = baseProfit !== 0 ? (profitDelta / Math.abs(baseProfit)) * 100 : 0;

    const simMonthlyBurn = (simCogs + simExpenses) / 12 || 3000;
    const simRunway = simMonthlyBurn > 0 ? cashPosition.totalLiquidCash / simMonthlyBurn : 12;

    const assessment =
      profitDelta >= 0
        ? `Positive scenario impact: Operating profit expands by +$${Math.round(profitDelta).toLocaleString()} (+${profitDeltaPct.toFixed(1)}%). Cash runway remains stable at ${simRunway.toFixed(1)} months.`
        : `Adverse scenario impact: Operating profit contracts by -$${Math.round(Math.abs(profitDelta)).toLocaleString()} (${profitDeltaPct.toFixed(1)}%). Cash runway reduces to ${simRunway.toFixed(1)} months.`;

    return {
      baseline: {
        netRevenue: parseFloat(baseRevenue.toFixed(2)),
        cogs: parseFloat(baseCogs.toFixed(2)),
        operatingExpenses: parseFloat(baseExpenses.toFixed(2)),
        operatingProfit: parseFloat(baseProfit.toFixed(2)),
        netMarginPct: parseFloat(baseMargin.toFixed(1)),
        cashRunwayMonths: parseFloat(baseRunway.toFixed(1)),
      },
      simulated: {
        netRevenue: parseFloat(simRevenue.toFixed(2)),
        cogs: parseFloat(simCogs.toFixed(2)),
        operatingExpenses: parseFloat(simExpenses.toFixed(2)),
        operatingProfit: parseFloat(simProfit.toFixed(2)),
        netMarginPct: parseFloat(simMargin.toFixed(1)),
        profitDelta: parseFloat(profitDelta.toFixed(2)),
        profitDeltaPct: parseFloat(profitDeltaPct.toFixed(1)),
        cashRunwayMonths: parseFloat(simRunway.toFixed(1)),
      },
      aiScenarioAssessment: assessment,
    };
  }
}
