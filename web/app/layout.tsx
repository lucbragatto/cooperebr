import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clube COOPERE-BR | Energia solar e benefícios",
  description:
    "Até 20% da sua fatura de energia em CooperTokens para usar nos parceiros do clube.",
  // iPhone: "Adicionar à Tela de Início" abre como app, com barra escura
  appleWebApp: {
    capable: true,
    title: "Clube Solar",
    statusBarStyle: "black-translucent",
  },
};

// viewport-fit=cover libera env(safe-area-inset-*) (notch e barra inferior do iPhone)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#101510",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
