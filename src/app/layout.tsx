import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "WereCode",
  description: "Music transcription, stems, lyrics, MIDI, and arrangement workspace.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
