import { CURRENCIES, CURRENCY_REGIONS, useCurrency } from '../context/CurrencyContext';
import type { CurrencyCode } from '../context/CurrencyContext';
import CurrencySelect from './CurrencySelect';
import type { CurrencyOption } from './CurrencySelect';

export default function CurrencyDropdown() {
  const { currency, setCurrency } = useCurrency();

  // Build option list in region order
  const options: CurrencyOption[] = CURRENCY_REGIONS.flatMap(region =>
    (Object.entries(CURRENCIES) as [CurrencyCode, typeof CURRENCIES[CurrencyCode]][])
      .filter(([, meta]) => meta.region === region)
      .map(([code, meta]) => ({ code, label: meta.label, symbol: meta.symbol, region }))
  );

  const sharedProps = {
    options,
    value: currency,
    onChange: (code: string) => setCurrency(code as CurrencyCode),
    listMaxHeight: 'max-h-72' as const,
    alignRight: true,
  };

  return (
    <>
      {/* Mobile (< md): symbol-only compact icon button */}
      <div className="md:hidden">
        <CurrencySelect {...sharedProps} compact />
      </div>

      {/* Desktop (≥ md): full "$ USD" label trigger */}
      <div className="hidden md:flex items-center gap-2">
        <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">
          Currency
        </span>
        <CurrencySelect {...sharedProps} className="w-28" />
      </div>
    </>
  );
}
