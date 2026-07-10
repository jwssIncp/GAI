import { ReactNode } from 'react';

export function PageContainer({ children }: { children: ReactNode }) {
  return <main className="relative isolate mx-auto flex w-full max-w-[1560px] flex-1 flex-col gap-6 p-4 pb-10 sm:p-6 sm:pb-12 lg:gap-7 lg:p-8 xl:px-10">{children}</main>;
}
