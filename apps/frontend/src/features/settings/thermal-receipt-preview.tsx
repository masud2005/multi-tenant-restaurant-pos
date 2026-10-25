import { getCurrencySymbol, calculateOrderBreakdown } from "./settings.utils";

export interface ThermalReceiptPreviewProps {
  name: string;
  tagline?: string | undefined;
  initials?: string | undefined;
  logoUrl?: string | undefined;
  address?: string | undefined;
  cashierName?: string | undefined;
  receiptFooter?: string | undefined;
  currency: string;
  taxRate: number;
  serviceRate: number;
  taxInclusive: boolean;
  roundCurrency: boolean;
}

export function ThermalReceiptPreview({
  name,
  tagline = "Artisanal Kitchen & Dining",
  initials = "POS",
  logoUrl,
  address = "Main Dining Hall, City Centre",
  cashierName = "Cashier",
  receiptFooter,
  currency,
  taxRate,
  serviceRate,
  taxInclusive,
  roundCurrency,
}: ThermalReceiptPreviewProps) {
  const currSym = getCurrencySymbol(currency);
  const sampleBase = 50.0;
  const { vatAmount, serviceAmount, grandTotal } = calculateOrderBreakdown(
    sampleBase,
    taxRate,
    serviceRate,
    taxInclusive,
    roundCurrency
  );

  return (
    <div className="w-full max-w-sm rounded-xl border-2 border-dashed border-border/80 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-5 shadow-xs font-mono text-xs space-y-3">
      {/* Header */}
      <div className="text-center space-y-1">
        {logoUrl ? (
          <div className="flex justify-center mb-1">
            <img
              src={logoUrl}
              alt="Logo"
              className="max-h-10 max-w-[120px] object-contain filter grayscale contrast-125"
            />
          </div>
        ) : (
          <div className="inline-flex size-7 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs uppercase mb-1">
            {initials || "POS"}
          </div>
        )}
        <div className="font-bold text-sm uppercase tracking-wide">
          {name || "Restaurant Name"}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {tagline}
        </div>
        <div className="text-[10px] text-zinc-400">
          {address}
        </div>
      </div>

      <div className="border-b border-dashed border-zinc-300 dark:border-zinc-800" />

      {/* Metadata */}
      <div className="space-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
        <div className="flex justify-between">
          <span>RECEIPT: #1042</span>
          <span>TBL: T-04 (Dine-in)</span>
        </div>
        <div className="flex justify-between">
          <span>DATE: 21-OCT-2026 14:30</span>
          <span>STAFF: {cashierName}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-zinc-300 dark:border-zinc-800" />

      {/* Sample Items */}
      <div className="space-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <span>1x Truffle Wild Mushroom Risotto</span>
          <span className="font-semibold">{currSym}24.00</span>
        </div>
        <div className="flex justify-between">
          <span>1x Grilled Norwegian Salmon</span>
          <span className="font-semibold">{currSym}18.00</span>
        </div>
        <div className="flex justify-between">
          <span>2x Artisanal Saffron Mocktail</span>
          <span className="font-semibold">{currSym}8.00</span>
        </div>
      </div>

      <div className="border-b border-dashed border-zinc-300 dark:border-zinc-800" />

      {/* Calculation breakdown */}
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
          <span>Subtotal</span>
          <span>
            {currSym}
            {sampleBase.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
          <span>
            VAT ({taxRate}%) {taxInclusive ? "(Included)" : ""}
          </span>
          <span>
            {taxInclusive ? "" : "+"}
            {currSym}
            {vatAmount.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
          <span>Service Charge ({serviceRate}%)</span>
          <span>
            +{currSym}
            {serviceAmount.toFixed(2)}
          </span>
        </div>
        <div className="border-t border-zinc-400 dark:border-zinc-700 pt-1 flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>
            {currSym}
            {roundCurrency ? grandTotal.toFixed(0) : grandTotal.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="border-b border-dashed border-zinc-300 dark:border-zinc-800" />

      {/* Dynamic Footer Message Preview */}
      <div className="text-center pt-1 space-y-2">
        <p className="text-[11px] leading-relaxed italic text-zinc-700 dark:text-zinc-300">
          {receiptFooter || "Thank you for dining with us! Please come again."}
        </p>
        <div className="text-[10px] text-zinc-400 tracking-widest">
          ||| ||||| |||| ||| ||||||| |||
        </div>
        <div className="text-[9px] uppercase text-zinc-400">
          *** CUSTOMER COPY ***
        </div>
      </div>
    </div>
  );
}
