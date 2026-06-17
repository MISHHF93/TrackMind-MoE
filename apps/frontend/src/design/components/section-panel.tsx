import type { HTMLAttributes, ReactElement, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { cn } from '@/lib/utils';

export function SectionPanel({
  title,
  description,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Card className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
