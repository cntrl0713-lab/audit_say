import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";
import { themeInitScript } from "../lib/themeScript";

const korean = Noto_Sans_KR({
  variable: "--font-korean",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AuditSay · 회계감사 서술형 학습",
  description: "KICPA 회계감사 문제 풀이와 서술형 답안 채점 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${korean.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <Navbar />
          <main id="main-content" className="flex-1 w-full max-w-[1440px] mx-auto px-4 md:px-8 py-6 flex flex-col">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
