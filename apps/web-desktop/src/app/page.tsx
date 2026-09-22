import { Test } from "@repo/ui/components/Test";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <Test />
    </div>
  );
}
