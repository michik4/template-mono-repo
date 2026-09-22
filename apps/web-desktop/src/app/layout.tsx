import type { Metadata } from "next";
import "@sr4/packages/ui/styles/global.css";
import styles from './layout.module.css';


export const metadata: Metadata = {
  title: "Стройрепутация 4.0",
  description: "",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body>
        <div className={styles.root_layout}>
          <div className={styles.root_content}>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
