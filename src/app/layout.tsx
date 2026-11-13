import type { Metadata } from "next";
import { Atkinson_Hyperlegible, Jost } from "next/font/google";
import "./globals.css";
import { EventProvider } from "@/components/event-context";
import { getSettings } from "@/lib/current-settings";
import { accentShades } from "@/lib/event-settings";

// Headings. Jost's round, geometric letters sit naturally beside the logo.
const display = Jost({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
// Body and forms. Atkinson Hyperlegible was drawn so that similar letters
// are hard to confuse, which suits pages many different people fill in.
const body = Atkinson_Hyperlegible({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const event = await getSettings();
  return {
    title: `${event.name} · ${event.host.name}`,
    description: event.description,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSettings();
  const shades = accentShades(settings.theme.accent);
  return (
    // Light is the default. The inline script below switches to dark before
    // the first paint for visitors who chose it, so the class attribute can
    // differ from the server's HTML: hence suppressHydrationWarning, which
    // only applies to this element's attributes.
    <html
      lang="en"
      suppressHydrationWarning
      className={`light ${display.variable} ${body.variable}`}
      style={
        {
          "--accent-base": shades.accent,
          "--accent-base-dark": shades.dark,
          "--accent-base-deep": shades.deep,
          "--accent-on-dark": shades.onDark,
        } as React.CSSProperties
      }
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('dua-theme')==='dark')document.documentElement.classList.remove('light')}catch(e){}",
          }}
        />
      </head>
      <body className="font-body antialiased">
        <EventProvider settings={settings}>{children}</EventProvider>
      </body>
    </html>
  );
}
