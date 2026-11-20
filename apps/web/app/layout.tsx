import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Dictation",
  description: "Hear a sentence, type it, see exactly what your ear missed.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
