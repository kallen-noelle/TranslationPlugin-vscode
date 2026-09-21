import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'peer size-4 shrink-0 rounded-[2px] border border-[var(--vscode-widget-border)] bg-[var(--vscode-input-background)] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--vscode-button-background)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[var(--vscode-button-background)] data-[state=checked]:text-[var(--vscode-button-foreground)]',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-current')}>
      <Check className="size-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
