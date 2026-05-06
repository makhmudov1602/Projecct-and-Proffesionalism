import styles from "./Header.module.scss";
import { FaRegUser } from "react-icons/fa";
import { HiOutlineArrowRightOnRectangle } from "react-icons/hi2";
import { useNavigate } from "react-router-dom";
import { dispatch } from "@/rudex";
import localStorageHelper from "@/utils";

function Header() {
  const navigate = useNavigate();
  const now = new Intl.DateTimeFormat("uz-UZ", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const handleLogout = () => {
    dispatch.auth.logoutAsync?.();
    localStorageHelper.removeItem("auth");
    localStorageHelper.removeItem("userData");
    localStorageHelper.removeItem("language");
    localStorageHelper.removeItem("isRefresh");
    navigate("/login");
  };

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        <div>
          <h1>Nishon Arena boshqaruv paneli</h1>
          <p>Live scoreboard, score capture va session management</p>
        </div>
      </div>

      <div className={styles.rightSection}>
        <div className={styles.infoCard}>
          <span>Bugun</span>
          <strong>{now}</strong>
        </div>
        <div className={styles.profile}>
          <FaRegUser />
          <span>Arena operatori</span>
        </div>
        <button className={styles.logout} onClick={handleLogout}>
          <HiOutlineArrowRightOnRectangle />
          Chiqish
        </button>
      </div>
    </header>
  );
}

export default Header;
