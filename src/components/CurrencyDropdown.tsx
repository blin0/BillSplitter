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

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline text-xs text-gray-400 dark:text-slate-500 font-medium">
        Currency
      </span>
      <CurrencySelect
        options={options}
        value={currency}
        onChange={code => setCurrency(code as CurrencyCode)}
        className="w-28"
        listMaxHeight="max-h-72"
        alignRight
      />
    </div>
  );
}
