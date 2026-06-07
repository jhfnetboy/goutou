import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { BuildRefreshGuard } from "@/components/app/build-refresh-guard";
import {
  SYSTEM_DESCRIPTION,
  brandingUrl,
  getSystemSettings,
  safeAccentColor,
} from "@/lib/system-settings";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSystemSettings();
  const favicon =
    brandingUrl(settings.faviconKey, settings.updatedAt) ?? "/favicon.ico";
  const ogImage =
    brandingUrl(settings.logoDarkKey, settings.updatedAt) ?? "/dark-logo.png";
  const appUrl = process.env.BETTER_AUTH_URL;
  return {
    ...(appUrl ? { metadataBase: new URL(appUrl) } : {}),
    title: {
      default: settings.webTitle,
      template: `%s · ${settings.webTitle}`,
    },
    description: SYSTEM_DESCRIPTION,
    applicationName: settings.systemName,
    icons: { icon: favicon, shortcut: favicon, apple: favicon },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: settings.systemName,
    },
    openGraph: {
      type: "website",
      siteName: settings.systemName,
      title: settings.webTitle,
      description: SYSTEM_DESCRIPTION,
      images: [{ url: ogImage }],
    },
    twitter: {
      card: "summary",
      title: settings.webTitle,
      description: SYSTEM_DESCRIPTION,
      images: [ogImage],
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const settings = await getSystemSettings();
  return { themeColor: safeAccentColor(settings.accentColor) };
}

const themeBootScript = `(function(){try{var t=localStorage.getItem('seeder-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}var s=localStorage.getItem('seeder-sidebar-collapsed');if(s==='true'){document.documentElement.setAttribute('data-sidebar-collapsed','true');}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSystemSettings();
  // Set the single accent base inline on <html>. Every other accent shade and
  // the sidebar palette derive from --brand via color-mix in globals.css, so one
  // validated hex re-tints the whole app in both themes — no FOUC (it's in the
  // initial HTML) and no hydration mismatch (deterministic server value).
  const accentStyle = {
    "--brand": safeAccentColor(settings.accentColor),
  } as React.CSSProperties;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={accentStyle}
      className={`${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full flex flex-col text-foreground">
        <BuildRefreshGuard />
        {children}
      </body>
    </html>
  );
}
