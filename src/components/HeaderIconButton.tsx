import Link from 'next/link';
import { cn } from '@/lib/utils';

// The one circular icon-button treatment for every header action across the app —
// back, close, delete, settings, transfer. Fixed 36px hit area and 20px icon so any
// two of these sitting in the same header row are pixel-identical by construction.
const baseClasses = 'w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors [&_svg]:h-5 [&_svg]:w-5';
const toneClasses = 'text-ink-soft hover:bg-sand';

interface HeaderIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: string;
}

export function HeaderIconButton({ href, className, children, ...props }: HeaderIconButtonProps) {
  if (href) {
    return (
      <Link href={href} className={cn(baseClasses, toneClasses, className)}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={cn(baseClasses, toneClasses, className)} {...props}>
      {children}
    </button>
  );
}
