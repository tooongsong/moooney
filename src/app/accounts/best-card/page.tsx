import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { PageHeader } from '@/components/PageHeader';
import { PaymentDue } from '@/components/PaymentDue';
import { getAccountBalances } from '@/app/actions/accounts';
import { getAllCategories } from '@/app/actions/manage';
import { bestCards, formatRate, type BestCardPick } from '@/lib/bestCard';
import { formatCurrency } from '@/lib/utils';

function Row({ label, pick, accent }: { label: string; pick: BestCardPick; accent: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4 py-5 border-b border-line">
      <div className="min-w-0 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft mb-1">{label}</p>
        <p className="text-base font-semibold text-ink break-words">
          {pick.cards.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ' · '}
              <Link href={`/accounts/${c.id}/details`} className="underline decoration-line underline-offset-4">{c.name}</Link>
            </span>
          ))}
        </p>
      </div>
      <p className={`shrink-0 text-5xl font-bold tracking-tighter leading-none tabular-nums ${accent ? 'text-accent' : 'text-ink'}`}>
        {formatRate(pick.rate)}
      </p>
    </div>
  );
}

export default async function BestCardPage() {
  const [accounts, categories] = await Promise.all([getAccountBalances(), getAllCategories()]);
  const cards = accounts.filter((a) => a.type === 'credit_card');
  if (cards.length === 0) redirect('/accounts');

  const { rows, fallback } = bestCards(cards, categories);
  const due = cards
    .filter((c) => c.nextDue !== null)
    .sort((a, b) => a.nextDue!.daysAway - b.nextDue!.daysAway || a.name.localeCompare(b.name));

  return (
    <div className="d-max-md max-lg:max-w-md mx-auto px-6 min-h-screen bg-paper pb-28">
      <PageHeader
        left={<HeaderIconButton href="/accounts" className="-ml-2" aria-label="Back to accounts"><ChevronLeft /></HeaderIconButton>}
        title="Best card"
      />

      {fallback === null ? (
        <div className="pt-10 pb-16">
          <p className="text-3xl font-bold tracking-tighter text-ink-faint leading-tight">
            NO REWARDS<br />YET.
          </p>
          <Link href={`/accounts/${cards[0].id}`}
            className="inline-block mt-6 text-xs font-bold uppercase tracking-widest text-ink underline underline-offset-4">
            Add rates to {cards[0].name}
          </Link>
        </div>
      ) : (
        <div>
          {rows.map((row, i) => (
            <Row key={row.category} label={row.category} pick={row} accent={i === 0} />
          ))}
          <Row label="Everything else" pick={fallback} accent={rows.length === 0} />
        </div>
      )}

      {due.length > 0 && (
        <section className="pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft mb-1">Payments due</h2>
          {due.map((card) => (
            <Link key={card.id} href={`/accounts/${card.id}`}
              className="flex items-center justify-between gap-4 py-4 border-b border-line">
              <span className="min-w-0">
                <span className="block text-base font-semibold text-ink truncate">{card.name}</span>
                <PaymentDue next={card.nextDue!} balance={card.balance} className="block text-xs font-semibold" />
              </span>
              <span className="shrink-0 text-base font-bold tabular-nums text-ink">
                {card.balance < 0 ? formatCurrency(Math.abs(card.balance)) : formatCurrency(0)}
              </span>
            </Link>
          ))}
        </section>
      )}

      <BottomNav />
    </div>
  );
}
