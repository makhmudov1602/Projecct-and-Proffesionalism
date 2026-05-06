import { Form } from "@/components/common/Form";
import styles from "./Login.module.scss";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import API from "@/services/api";
import { message } from "antd";
import { dispatch } from "@/rudex";
import LogoMark from "@/assets/img/university-mark.svg";
import { Input } from "@/components/common/Input";
import { HiOutlineAcademicCap, HiOutlineChartBar, HiOutlineVideoCamera } from "react-icons/hi2";

const highlights = [
  { icon: <HiOutlineAcademicCap />, text: "Ishtirokchilarni tez qo‘shish" },
  { icon: <HiOutlineVideoCamera />, text: "Kamera preview va score capture" },
  { icon: <HiOutlineChartBar />, text: "Leaderboard va PDF export" },
];

function Login() {
  const { t } = useTranslation();

  const { isPending: isPendingMe, mutate: mutateMe } = useMutation({
    mutationFn: () => API.getUser(),
    onSuccess: (response) => {
      if (response) {
        dispatch.userData.changeUserData(response);
        message.success("Muvaffaqiyatli kiritildi");
      }
    },
    onError: (err: Error) => {
      message.error(err.message);
    },
  });

  const { isPending, mutate } = useMutation({
    mutationFn: (data: { username: string; password: string }) => API.login(data),
    onSuccess: (response) => {
      if (response) {
        dispatch.auth.login({
          token: response.token,
          refreshToken: response.refreshToken,
        });
        mutateMe();
        message.success("Muvaffaqiyatli kiritildi");
      }
    },
    onError: (err: Error) => {
      message.error(err.message);
    },
  });

  const onFinish = (data: { username: string; password: string }) => {
    mutate(data);
  };

  const isloading = isPendingMe || isPending;

  return (
    <div className={styles.login}>
      <div className={styles.shell}>
        <section className={styles.leftPanel}>
          <div className={styles.brandRow}>
            <img src={LogoMark} alt="Universitet logotipi" />
            <div>
              <strong>Nishon Arena</strong>
              <span>Archery & Rifle competition</span>
            </div>
          </div>

          <div className={styles.heroText}>
            <span className={styles.badge}>Yangi interfeys</span>
            <h1>Archery va rifle competition boshqaruv paneliga xush kelibsiz</h1>
            <p>
              Platforma operatorlarga ishtirokchilarni qo‘shish, kameralarni ulash, otish natijalarini qayd etish va g‘olibni aniqlash imkonini beradi.
            </p>
          </div>

          <div className={styles.highlightList}>
            {highlights.map((item) => (
              <div key={item.text} className={styles.highlightItem}>
                <span>{item.icon}</span>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.rightPanel}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h2>Tizimga kirish</h2>
              <p>Operator akkaunti orqali arena sessiyasini boshlang.</p>
            </div>

            <Form className={styles.form} onFinish={onFinish}>
              <div className={styles.fieldLabel}>Foydalanuvchi nomi</div>
              <Input
                type="text"
                name="username"
                placeholder="Username"
                className={styles.inputField}
                rules={[{ required: true, message: "Maydon majburiy" }]}
              />
              <div className={styles.fieldLabel}>Parol</div>
              <Input
                type="password"
                name="password"
                placeholder="Password"
                className={styles.inputField}
                rules={[{ required: true, message: "Maydon majburiy" }]}
              />
              <button type="submit" className={styles.formButton} disabled={isloading}>
                {t("auth.login")}
              </button>
            </Form>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
