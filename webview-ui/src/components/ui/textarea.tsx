import * as React from 'react';
import { cn } from '../../lib/utils';

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[60px] w-full rounded-[2px] border border-[var(--vscode-input-border,transparent)] bg-[var(--vscode-input-background)] px-2 py-2 text-[13px] text-[var(--vscode-input-foreground)] shadow-sm placeholder:text-[var(--vscode-descriptionForeground)] focus-visible:outline-none focus-visible:border-[var(--vscode-inputOption-activeBorder,var(--vscode-button-background))] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
