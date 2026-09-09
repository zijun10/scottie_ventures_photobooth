import type { Metadata } from "next";
import { Libre_Baskerville } from "next/font/google";
import "./globals.css";

const libreBaskerville = Libre_Baskerville({
  variable: "--font-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Scottie Ventures Photo Booth",
  description: "V stands for venture capital.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${libreBaskerville.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
