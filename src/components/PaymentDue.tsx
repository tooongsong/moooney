import { isDueSoon, type NextDue } from '@/lib/paymentDue';
import { relativeDayLabel } from '@/lib/subscriptionSchedule';
import { cn, formatDate } from '@/lib/utils';

/** "Due Nov 25 · in 6 days". Accent only when the date is near and money is owed. */
export function PaymentDue({ next, balance, className }: { next: NextDue; balance: number; className?: string }) {
  return (
    <span className={cn(isDueSoon(next, balance) ? 'text-accent' : 'text-ink-soft', className)}>
      Due {formatDate(next.date, { month: 'short', day: 'numeric' })} · {relativeDayLabel(next.daysAway)}
    </span>
  );
}
