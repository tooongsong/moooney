import { CreditCard, Landmark, Wallet, PiggyBank, TrendingUp, Building2, Banknote } from 'lucide-react';

const ICONS: Record<string, typeof Wallet> = {
  cash:        Wallet,
  bank:        Landmark,
  checking:    Landmark,
  savings:     PiggyBank,
  investment:  TrendingUp,
  credit_card: CreditCard,
  loan:        Banknote,
  mortgage:    Building2,
};

export function AccountTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type] ?? Landmark;
  return <Icon className={className} />;
}
