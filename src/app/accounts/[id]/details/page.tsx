import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { CardNotes } from '@/components/CardNotes';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { PageHeader } from '@/components/PageHeader';
import { getCardNotes } from '@/app/actions/accounts';

export default async function CardDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await getCardNotes(id);
  if (!card) notFound();

  return (
    <div className="d-max-md max-lg:max-w-md mx-auto px-6 min-h-screen bg-paper pb-28">
      <PageHeader
        left={<HeaderIconButton href={`/accounts/${id}`} className="-ml-2" aria-label="Back to card"><ChevronLeft /></HeaderIconButton>}
        title={card.name}
      />
      <CardNotes accountId={id} initial={card.notes} />
      <BottomNav />
    </div>
  );
}
