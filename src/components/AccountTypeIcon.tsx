import { CreditCard, Landmark, Wallet, PiggyBank, TrendingUp, Building2, Banknote, CircleDollarSign } from 'lucide-react';

const ICONS: Record<string, typeof Wallet> = {
  cash:             Wallet,
  bank:             Landmark,
  checking:         Landmark,
  savings:          PiggyBank,
  investment:       TrendingUp,
  other_asset:      CircleDollarSign,
  credit_card:      CreditCard,
  loan:             Banknote,
  mortgage:         Building2,
  other_liability:  CircleDollarSign,
};

export function AccountTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type] ?? Landmark;
  return <Icon className={className} />;
}
