import { CreditCard, Landmark, Wallet } from 'lucide-react';
import type { AccountType } from '@/lib/accountTypes';

const ICONS: Record<AccountType, typeof Wallet> = {
  cash: Wallet,
  bank: Landmark,
  credit_card: CreditCard,
};

export function AccountTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type as AccountType] || Landmark;
  return <Icon className={className} />;
}
