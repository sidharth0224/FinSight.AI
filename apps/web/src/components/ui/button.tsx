import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const variants = cva('btn', {
  variants: {
    variant: {
      default: 'btn-primary',
      outline: 'btn-outline',
      ghost: 'btn-ghost',
      secondary: 'btn-secondary',
      destructive: 'btn-danger',
    },
    size: { default: '', sm: 'btn-sm', icon: 'btn-icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});
export function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>) {
  return <button className={cn(variants({ variant, size }), className)} {...props} />;
}
