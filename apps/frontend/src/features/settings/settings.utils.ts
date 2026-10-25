/**
 * Utility functions for the Settings feature.
 */

export function getCurrencySymbol(curr: string): string {
  switch (curr) {
    case "BDT":
      return "৳";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "CAD":
      return "CA$";
    case "USD":
    default:
      return "$";
  }
}

export interface OrderCalculationResult {
  baseAmount: number;
  vatAmount: number;
  serviceAmount: number;
  grandTotal: number;
}

export function calculateOrderBreakdown(
  baseAmount: number,
  taxRatePercent: number,
  serviceChargePercent: number,
  taxInclusive: boolean,
  roundCurrency: boolean
): OrderCalculationResult {
  let vatAmount = 0;
  let serviceAmount = 0;
  let grandTotal = 0;

  if (taxInclusive) {
    // Menu price includes tax: Tax = Base - (Base / (1 + Rate))
    vatAmount = baseAmount - baseAmount / (1 + taxRatePercent / 100);
    serviceAmount = baseAmount * (serviceChargePercent / 100);
    grandTotal = baseAmount + serviceAmount;
  } else {
    // Tax added on top of base
    vatAmount = baseAmount * (taxRatePercent / 100);
    serviceAmount = baseAmount * (serviceChargePercent / 100);
    grandTotal = baseAmount + vatAmount + serviceAmount;
  }

  if (roundCurrency) {
    grandTotal = Math.round(grandTotal);
  }

  return {
    baseAmount,
    vatAmount,
    serviceAmount,
    grandTotal,
  };
}
