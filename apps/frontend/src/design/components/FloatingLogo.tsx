import type { ReactElement } from 'react';
import trackmindLogo from '@/assets/trackmind-logo.png';
import { cn } from '@/lib/utils';

type FloatingLogoSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClass: Record<FloatingLogoSize, string> = {
  sm: 'brand-mark--sm',
  md: 'brand-mark--md',
  lg: 'brand-mark--lg',
  xl: 'brand-mark--xl',
};

export function FloatingLogo({
  size = 'md',
  floating = true,
  className,
}: {
  size?: FloatingLogoSize;
  floating?: boolean;
  className?: string;
}): ReactElement {
  return (
    <div
      className={cn('brand-mark', sizeClass[size], floating && 'brand-mark--floating', className)}
      aria-hidden
    >
      <img src={trackmindLogo} alt="" draggable={false} />
    </div>
  );
}
