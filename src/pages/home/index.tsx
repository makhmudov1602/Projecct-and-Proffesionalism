import { useNavigate } from 'react-router-dom';
import { HiArrowRight, HiOutlineChartBar, HiOutlineTrophy, HiOutlineVideoCamera } from 'react-icons/hi2';
import styles from './Home.module.scss';

const features = [
  {
    title: 'Multiplayer sessiyalar',
    text: '2–10 ishtirokchi uchun archery yoki rifle battle sessiyalarini tez ishga tushirish mumkin.',
    icon: <HiOutlineTrophy />,
  },
  {
    title: 'Kamera asosida score capture',
    text: 'Har bir player uchun kamera biriktiriladi, test preview olinadi va zarba natijasi qayd etiladi.',
    icon: <HiOutlineVideoCamera />,
  },
  {
    title: 'Live leaderboard va export',
    text: 'Jami ball, o‘rtacha natija va g‘olibni ko‘rsatadigan leaderboard hamda PDF export mavjud.',
    icon: <HiOutlineChartBar />,
  },
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <section className={styles.home}>
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.badge}>Nishon Arena</span>
          <h2>Kamon va tir bo‘yicha live competition platformasi</h2>
          <p>
            Bu platforma parklar, shooting zonalar va trening maydonlari uchun mo‘ljallangan. U kim nechta otganini,
            nechchi ball to‘plaganini va kim g‘olib bo‘lganini real vaqt rejimida ko‘rsatadi.
          </p>
          <button className={styles.primaryAction} onClick={() => navigate('/start')}>
            Sessiyani ochish
            <HiArrowRight />
          </button>
        </div>

        <div className={styles.heroPanel}>
          <div className={styles.panelCard}>
            <strong>Rejimlar</strong>
            <span>Archery va Rifle</span>
          </div>
          <div className={styles.panelCard}>
            <strong>Scoring</strong>
            <span>Markazga masofa va halqa bo‘yicha avtomatik ball</span>
          </div>
          <div className={styles.panelCard}>
            <strong>Output</strong>
            <span>Leaderboard, winner panel va PDF export</span>
          </div>
        </div>
      </div>

      <div className={styles.featureGrid}>
        {features.map((feature) => (
          <article key={feature.title} className={styles.featureCard}>
            <div className={styles.featureIcon}>{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Home;
