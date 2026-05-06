import styles from "./Footer.module.scss";

const Footer = () => {
  const uzbekDate = new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  return (
    <footer className={styles.footer}>
      <span>© {uzbekDate} · Nishon Arena platformasi</span>
      <span>Frontend: live competition UI</span>
    </footer>
  );
};

export default Footer;
