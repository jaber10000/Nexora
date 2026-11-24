import type { Metadata } from 'next';
import './globals.css';
import './theme.css';
import './notifications.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { StoreProvider } from '@/components/store-provider';
import { AuthProvider } from '@/components/auth-provider';
import { ToastHost } from '@/components/toast-host';
import { DynamicFavicon } from '@/components/store-logo';
import { ThemeProvider } from '@/components/theme-provider';
import { THEME_BOOT_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'NEXORA — Shop Smarter. Live Better.',
  icons: { icon: '/favicon.svg', apple: '/app-icon.svg' },
  description:
    'A considered collection of technology, lifestyle and everyday essentials in Bangladesh.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} /></head>
      <body>
        <AuthProvider>
        <ThemeProvider>
        <StoreProvider>
          <DynamicFavicon />
          <SiteHeader />
          {children}
          <SiteFooter />
          <ToastHost />
        </StoreProvider>
        </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}