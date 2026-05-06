import { useCallback, useEffect, useMemo, useState } from 'react';
import { HiOutlineCheckBadge, HiOutlineSignal, HiOutlineUsers } from 'react-icons/hi2';
import Faceid from '@/components/FaceID/Faceid';
import API, { type ArenaCaptureResponse, type ArenaPlayer, type ArenaSessionSummary, type GameMode } from '@/services/api';
import ResultsTable from './components/Results/ResultsTable';
import StartStop from './components/StartStop/StartStop';
import UserLayout from './components/UserLayout/UserLayout';
import styles from './Start.module.scss';

type LocalPlayer = ArenaPlayer & { photoUrl?: string };

const emptyPlayer = (data: { id: string; name: string; nickname?: string; photoUrl?: string }): LocalPlayer => ({
  id: data.id,
  name: data.name,
  nickname: data.nickname,
  photo_url: data.photoUrl,
  photoUrl: data.photoUrl,
  camera_id: null,
  shots: [],
  shots_used: 0,
  total_score: 0,
  average_score: 0,
  last_shot: null,
  best_shot: 0,
  tens_count: 0,
  hit_count: 0,
});

function Start() {
  const [players, setPlayers] = useState<LocalPlayer[]>([]);
  const [scoreboard, setScoreboard] = useState<ArenaPlayer[]>([]);
  const [session, setSession] = useState<ArenaSessionSummary | null>(null);
  const [started, setStarted] = useState(false);
  const [healthStatus, setHealthStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [config, setConfig] = useState({
    title: 'Weekend Arena Battle',
    mode: 'archery' as GameMode,
    maxShots: 5,
    location: 'Main Range',
  });

  const checkHealth = useCallback(() => {
    setHealthStatus('checking');
    API.healthCheck()
      .then((data) => setHealthStatus(data.status === 'healthy' ? 'online' : 'offline'))
      .catch(() => setHealthStatus('offline'));
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const handlePlayerAdd = (user: { id?: string; name: string; nickname?: string; photoUrl?: string }) => {
    const normalized = user.name.trim().toLowerCase();
    if (players.some((player) => player.name.trim().toLowerCase() === normalized)) {
      alert('Bu ishtirokchi allaqachon qo‘shilgan.');
      return;
    }

    setPlayers((prev) => [...prev, emptyPlayer({ id: user.id || crypto.randomUUID(), name: user.name, nickname: user.nickname, photoUrl: user.photoUrl })]);
  };

  const handlePlayerRemove = (playerId: string) => {
    setPlayers((prev) => prev.filter((player) => player.id !== playerId));
    setScoreboard((prev) => prev.filter((player) => player.id !== playerId));
  };

  const syncPlayersToSession = async (sessionId: string) => {
    const synced: LocalPlayer[] = [];
    for (const player of players) {
      const response = await API.addArenaPlayer(sessionId, {
        name: player.name,
        nickname: player.nickname,
        photo_url: player.photo_url || player.photoUrl,
        camera_id: player.camera_id ?? null,
      });
      synced.push({ ...response.player, photoUrl: response.player.photo_url });
    }
    setPlayers(synced);
    return synced;
  };

  const handleStart = async () => {
    if (players.length === 0) {
      alert('Avval kamida bitta ishtirokchini qo‘shing.');
      return;
    }

    try {
      let currentSession = session;
      let syncedPlayers = players;

      if (!currentSession || currentSession.status === 'finished') {
        const created = await API.createArenaSession(config);
        currentSession = created.session;
        setSession(currentSession);
        syncedPlayers = await syncPlayersToSession(currentSession.id);
      }

      const startedResponse = await API.startArenaSession(currentSession.id);
      const startedSession = startedResponse.session;
      const startedScoreboard = startedSession.players?.length ? startedSession.players : syncedPlayers;

      setSession({ ...startedSession, players: startedScoreboard, winner: startedScoreboard[0] ?? null });
      setScoreboard(startedScoreboard);
      setStarted(true);
    } catch (error: any) {
      alert(error?.message || 'Sessiyani boshlashda xatolik yuz berdi.');
    }
  };

  const handleRestart = () => {
    setStarted(false);
    setSession(null);
    setScoreboard([]);
    setPlayers((prev) => prev.map((player) => ({ ...emptyPlayer({ id: player.id, name: player.name, nickname: player.nickname, photoUrl: player.photo_url || player.photoUrl }), camera_id: player.camera_id ?? null })));
  };

  const handleFinish = async () => {
    if (!session) return;
    try {
      const response = await API.finishArenaSession(session.id);
      setSession(response.session);
      setScoreboard(response.session.players || scoreboard);
    } catch {
      // ignore and keep local results
    } finally {
      setStarted(false);
    }
  };

  const handlePlayerChange = (playerId: string, patch: Partial<LocalPlayer>) => {
    setPlayers((prev) => prev.map((player) => (player.id === playerId ? { ...player, ...patch } : player)));
    setScoreboard((prev) => prev.map((player) => (player.id === playerId ? { ...player, ...patch } : player)));
  };

  const handleCaptureSuccess = (response: ArenaCaptureResponse) => {
    setScoreboard(response.scoreboard);
    setPlayers((prev) =>
      prev.map((player) => {
        const updated = response.scoreboard.find((row) => row.id === player.id);
        return updated ? { ...player, ...updated, photoUrl: player.photoUrl || updated.photo_url } : player;
      })
    );

    setSession((prev) =>
      prev
        ? {
            ...prev,
            status: response.session_status,
            players: response.scoreboard,
            winner: response.winner || null,
          }
        : prev
    );

    if (response.session_status === 'finished') {
      setStarted(false);
    }
  };

  const displayPlayers = useMemo(() => {
    if (scoreboard.length === 0) return players;
    return players.map((player) => {
      const ranked = scoreboard.find((item) => item.id === player.id);
      return ranked ? { ...player, ...ranked, photoUrl: player.photoUrl || ranked.photo_url } : player;
    });
  }, [players, scoreboard]);

  const summaryCards = [
    {
      label: 'Ishtirokchilar',
      value: players.length,
      icon: <HiOutlineUsers />,
    },
    {
      label: 'Qayd etilgan otishlar',
      value: scoreboard.reduce((sum, player) => sum + player.shots_used, 0),
      icon: <HiOutlineCheckBadge />,
    },
    {
      label: 'Eng yaxshi natija',
      value: scoreboard[0]?.total_score ?? 0,
      icon: <HiOutlineSignal />,
    },
  ];

  return (
    <div className={styles.appContainer}>
      <section className={styles.heroSection}>
        <div>
          <span className={styles.heroBadge}>Arena management</span>
          <h2>Kamon va tir bo‘yicha live competition boshqaruv paneli</h2>
          <p>
            Platforma do‘stlar, mehmonlar yoki kichik guruhlar o‘rtasidagi sessiyalarni boshqaradi: kim nechta otganini,
            jami ballni va real vaqt reytingini bitta joyda ko‘rsatadi.
          </p>
        </div>

        <button className={styles.healthButton} onClick={checkHealth}>
          <span className={`${styles.healthDot} ${styles[healthStatus]}`}></span>
          {healthStatus === 'checking' ? 'Tekshirilmoqda' : healthStatus === 'online' ? 'Backend ulangan' : 'Demo rejim'}
        </button>
      </section>

      <section className={styles.summaryGrid}>
        {summaryCards.map((card) => (
          <article key={card.label} className={styles.summaryCard}>
            <div className={styles.summaryIcon}>{card.icon}</div>
            <div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          </article>
        ))}
      </section>

      <Faceid onAuthenticated={handlePlayerAdd} />

      <StartStop
        started={started}
        participantCount={players.length}
        sessionStatus={session?.status || 'waiting'}
        config={config}
        onConfigChange={(patch) => setConfig((prev) => ({ ...prev, ...patch }))}
        handleStart={handleStart}
        handleRestart={handleRestart}
        handleFinish={handleFinish}
      />

      <section className={styles.participantSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Ishtirokchilar kartalari</h3>
            <p>Har bir ishtirokchi uchun kamera tanlang, test preview oling va otishlarni navbatma-navbat qayd eting.</p>
          </div>
        </div>

        {displayPlayers.length === 0 ? (
          <div className={styles.emptyState}>Hozircha ishtirokchi yo‘q. Yuqoridan yangi player qo‘shing.</div>
        ) : (
          <div className={styles.userGrid}>
            {displayPlayers.map((player) => (
              <UserLayout
                key={player.id}
                player={player}
                mode={config.mode}
                sessionId={session?.id}
                started={started}
                maxShots={config.maxShots}
                onRemove={() => handlePlayerRemove(player.id)}
                onPlayerChange={(patch) => handlePlayerChange(player.id, patch)}
                onCaptureSuccess={handleCaptureSuccess}
              />
            ))}
          </div>
        )}
      </section>

      {scoreboard.length > 0 ? (
        <section className={styles.resultsSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Leaderboard</h3>
              <p>Real vaqt natijalari va sessiya yakunidagi umumiy reyting shu yerda shakllanadi.</p>
            </div>
          </div>
          <ResultsTable session={session} results={scoreboard} />
        </section>
      ) : null}
    </div>
  );
}

export default Start;
