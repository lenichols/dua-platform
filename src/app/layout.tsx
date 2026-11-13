import type { Metadata } from "next";
import { Bebas_Neue, Barlow, Barlow_Condensed, EB_Garamond } from "next/font/google";
import "./globals.css";
import { EVENT } from "@/lib/site";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});
const barlow = Barlow({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});
const barlowCond = Barlow_Condensed({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow-cond",
  display: "swap",
});
// Serif for the event name in the hero (a Garamond; Times/Georgia fallback)
const garamond = EB_Garamond({
  weight: ["500", "600"],
  subsets: ["latin"],
  variable: "--font-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${EVENT.name} · ${EVENT.host.name}`,
  description: EVENT.description,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the inline theme script below adds the "light"
    // class to <html> before React hydrates, so the class attribute is
    // expected to differ from the server-rendered HTML. Suppression only
    // applies to this element's attributes, not its children.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${bebas.variable} ${barlow.variable} ${barlowCond.variable} ${garamond.variable}`}
    >
      <head>
        {/* Apply the saved theme before paint to avoid a flash. Default light. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('theme')!=='dark')document.documentElement.classList.add('light')}catch(e){document.documentElement.classList.add('light')}",
          }}
        />
      </head>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
