import type { Metadata } from "next";
import "@sr4/ui/styles/global.css";

export const metadata: Metadata = {
  title: "Стройрепутация 4.0",
  description: "",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
