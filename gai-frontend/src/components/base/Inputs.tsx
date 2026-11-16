import type { ComponentProps } from 'react';
import { Input } from '@/components/ui/input';

export function DateInput(props: React.ComponentProps<typeof Input>) {
  return <Input type="date" {...props} />;
}

export function FileUpload({ onFile, ...props }: ComponentProps<typeof Input> & { onFile?: (file: File) => void }) {
  return <Input type="file" onChange={(event) => event.target.files?.[0] && onFile?.(event.target.files[0])} {...props} />;
}
