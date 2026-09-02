import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getProfile, getPreferences, listArchivedAccounts } from '@/app/actions/settings';
import { getAccountBalances } from '@/app/actions/accounts';
import {
  addPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  listCustomCategories,
  addCustomCategory,
  renameCustomCategory,
  deleteCustomCategory,
} from '@/app/actions/manage';
import { signOut } from '@/app/actions/auth';
import { formatCurrency } from '@/lib/utils';
import { CATEGORIES } from '@/lib/categories';
import { ManageList } from '@/components/ManageList';
import { ProfileSection } from './ProfileSection';
import { ThemeToggle } from './ThemeToggle';
import { ExportButtons } from './ExportButtons';
import { ArchivedSection } from './ArchivedSection';
import { PreferencesSection } from './PreferencesSection';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-3">
      {children}
    </p>
  );
}

export default async function SettingsPage() {
  const [profile, prefs, accounts, archived, categories] = await Promise.all([
    getProfile(),
    getPreferences(),
    getAccountBalances(),
    listArchivedAccounts(),
    listCustomCategories(),
  ]);

  return (
    <div className="d-max-md max-lg:max-w-md mx-auto px-6 min-h-screen bg-paper pb-16">
      {/* Back */}
      <div className="pt-5 pb-2 flex items-center gap-3">
        <Link href="/" className="text-ink-faint hover:text-ink transition-colors -ml-1">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint">Settings</p>
      </div>

      {/* PROFILE */}
      <section className="pt-6">
        <SectionLabel>Profile</SectionLabel>
        <ProfileSection name={profile.name} email={profile.email} avatarUrl={profile.avatarUrl} />
      </section>

      {/* PREFERENCES */}
      <section className="pt-8">
        <SectionLabel>Preferences</SectionLabel>
        <PreferencesSection
          currency={prefs.currency}
          defaultAccount={prefs.defaultAccount}
          accountNames={accounts.map((a) => a.name)}
        />
      </section>

      {/* CATEGORIES */}
      <section className="pt-8">
        <SectionLabel>Categories</SectionLabel>
        <ManageList
          title=""
          description=""
          placeholder="e.g. Childcare"
          items={categories}
          builtIn={[...CATEGORIES]}
          onAdd={addCustomCategory}
          onDelete={deleteCustomCategory}
          onRename={renameCustomCategory}
        />
      </section>

      {/* ACCOUNTS */}
      <section className="pt-8">
        <SectionLabel>Accounts</SectionLabel>
        <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-2">Active</p>
        <ManageList
          title=""
          description=""
          placeholder="e.g. Chase Sapphire"
          withStartingBalance
          withAccountType
          items={accounts.map((a) => ({
            id: a.id,
            name: a.name,
            subtitle: formatCurrency(a.balance),
            type: a.type,
            institution: a.institution ?? undefined,
          }))}
          onAdd={addPaymentMethod}
          onDelete={deletePaymentMethod}
          onUpdate={updatePaymentMethod}
        />
        {archived.length > 0 && (
          <div className="pt-6">
            <p className="text-[9px] font-bold uppercase tracking-widest text-ink-faint mb-2">Archived</p>
            <ArchivedSection
              accounts={archived.map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                institution: a.institution ?? null,
              }))}
            />
          </div>
        )}
      </section>

      {/* APPEARANCE */}
      <section className="pt-8">
        <SectionLabel>Appearance</SectionLabel>
        <div className="py-3 flex items-center justify-between">
          <span className="text-sm text-ink">Theme</span>
          <ThemeToggle />
        </div>
      </section>

      {/* DATA & PRIVACY */}
      <section className="pt-8">
        <SectionLabel>Data &amp; Privacy</SectionLabel>
        <ExportButtons />
      </section>

      {/* SECURITY */}
      <section className="pt-8">
        <SectionLabel>Security</SectionLabel>
        <form action={signOut}>
          <button
            type="submit"
            className="py-3 text-sm text-ink-faint hover:text-ink transition-colors"
          >
            Sign out
          </button>
        </form>
      </section>
    </div>
  );
}
