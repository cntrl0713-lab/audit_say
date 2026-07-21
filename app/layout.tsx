import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { Navbar } from "../components/Navbar";

// CursorGothic(라이선스 폰트) 대체로 Inter 단일 패밀리 사용 (DESIGN.md 권장 사항).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Audit Say 🏹",
  description: "KICPA 회계감사 AI 채점 및 문제 풀기 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
