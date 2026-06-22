import type { ReactElement } from 'react';
import trackmindLogo from '@/assets/trackmind-logo.png';
import { cn } from '@/lib/utils';

type FloatingLogoSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClass: Record<FloatingLogoSize, string> = {
  sm: 'brand-logo--sm',
  md: 'brand-logo--md',
  lg: 'brand-logo--lg',
  xl: 'brand-logo--xl',
};

export function FloatingLogo({
  size = 'md',
  className,
}: {
  size?: FloatingLogoSize;
  className?: string;
}): ReactElement {
  return (
    <img
      src={trackmindLogo}
      alt=""
      draggable={false}
      aria-hidden
      className={cn('brand-logo', sizeClass[size], className)}
    />
  );
}
