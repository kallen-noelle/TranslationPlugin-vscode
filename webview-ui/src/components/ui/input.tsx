import * as React from 'react';
import { cn } from '../../lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-[26px] w-full rounded-[2px] border border-[var(--vscode-input-border,transparent)] bg-[var(--vscode-input-background)] px-2 py-1 text-[13px] text-[var(--vscode-input-foreground)] transition-colors placeholder:text-[var(--vscode-descriptionForeground)] focus-visible:outline-none focus-visible:border-[var(--vscode-inputOption-activeBorder,var(--vscode-button-background))] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
