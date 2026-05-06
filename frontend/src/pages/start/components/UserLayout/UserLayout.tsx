import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HiOutlineCamera, HiOutlinePlay, HiOutlineSignal, HiOutlineTrophy, HiOutlineXMark } from 'react-icons/hi2';
import defaultUser from '@/assets/img/user.jpg';
import API, { type ArenaCaptureResponse, type ArenaPlayer, type Camera, type GameMode } from '@/services/api';
import styles from './UserLayout.module.scss';

export interface UserCardPlayer extends ArenaPlayer {
  photoUrl?: string;
}

interface Props {
  player: UserCardPlayer;
  mode: GameMode;
  sessionId?: string | null;
  started: boolean;
  maxShots: number;
  onRemove: () => void;
  onPlayerChange: (patch: Partial<UserCardPlayer>) => void;
  onCaptureSuccess: (response: ArenaCaptureResponse) => void;
}

const UserLayout = ({
  player,
  mode,
  sessionId,
  started,
  maxShots,
  onRemove,
  onPlayerChange,
  onCaptureSuccess,
}: Props) => {
  const [selectedCamera, setSelectedCamera] = useState<number | ''>(player.camera_id ?? '');
  const [statusText, setStatusText] = useState('Kamera tanlanmagan');
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualCamera, setManualCamera] = useState({
    description: `${player.name} kamerasi`,
    ip_address: '',
    username: 'admin',
    password: '',
    port: 554,
    source: '/Streaming/Channels/101',
  });
  const queryClient = useQueryClient();

  const { data: cameras = [] } = useQuery({
    queryKey: ['cameras'],
    queryFn: () => API.getCameras({ skip: 0, limit: 50 }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (player.camera_id && !selectedCamera) {
      setSelectedCamera(player.camera_id);
    }
  }, [player.camera_id, selectedCamera]);

  const currentPhoto = player.photo_url || player.photoUrl || defaultUser;

  const progressPercent = useMemo(() => {
    if (!maxShots) return 0;
    return Math.min(100, Math.round((player.shots_used / maxShots) * 100));
  }, [maxShots, player.shots_used]);

  const activateSelectedCamera = async () => {
    if (!selectedCamera) {
      setStatusText('Avval kamera tanlang.');
      return;
    }

    setStatusText('Kamera ulanmoqda...');
    await API.activateCamera(Number(selectedCamera));
    await API.clearBaseline(Number(selectedCamera));
    setStatusText(`Kamera ${selectedCamera} tayyor.`);
  };

  const handleTestCapture = async () => {
    if (!selectedCamera) {
      setStatusText('Test uchun kamera tanlang.');
      return;
    }
    const image = await API.testCapture(Number(selectedCamera));
    setFrameUrl(image);
    setStatusText('Test kadr olindi.');
  };

  const handleManualCameraConnect = async () => {
    if (!manualCamera.ip_address.trim()) {
      setStatusText('IP manzilni kiriting.');
      return;
    }

    setLoading(true);
    setStatusText('IP kamera ulanmoqda...');
    try {
      const response = await API.addManualCamera({
        description: manualCamera.description.trim() || `${player.name} kamerasi`,
        ip_address: manualCamera.ip_address.trim(),
        username: manualCamera.username.trim() || 'admin',
        password: manualCamera.password,
        port: Number(manualCamera.port) || 554,
        source: manualCamera.source.trim() || '/Streaming/Channels/101',
        auto_start: true,
      });
      await queryClient.invalidateQueries({ queryKey: ['cameras'] });
      setSelectedCamera(response.camera.Id);
      onPlayerChange({ camera_id: response.camera.Id });
      setShowManualForm(false);
      setStatusText(`Kamera ${response.camera.Id} ulandi.`);
      const image = await API.testCapture(response.camera.Id);
      setFrameUrl(image);
    } catch (error: any) {
      setStatusText(error?.message || 'IP kamerani ulashda xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async () => {
    if (!sessionId) {
      setStatusText('Avval sessiyani yarating va boshlang.');
      return;
    }
    if (!selectedCamera) {
      setStatusText('Avval kamera tanlang.');
      return;
    }
    if (!started) {
      setStatusText('Sessiya hali faol emas.');
      return;
    }
    if (player.shots_used >= maxShots) {
      setStatusText('Bu ishtirokchi limitga yetgan.');
      return;
    }

    setLoading(true);
    setStatusText('Otish natijasi qayta ishlanmoqda...');

    try {
      const response = await API.captureArenaShot(sessionId, player.id, {
        camera_id: Number(selectedCamera),
        shot_count: 1,
        mode,
      });

      if (response.visualization?.image) {
        setFrameUrl(`data:${response.visualization.mime_type};base64,${response.visualization.image}`);
      }

      const updatedPlayer = response.scoreboard.find((item) => item.id === player.id) || response.player;
      onPlayerChange({ ...updatedPlayer, camera_id: Number(selectedCamera) });
      onCaptureSuccess(response);
      setStatusText(`Oxirgi otish: ${updatedPlayer.last_shot ?? '-'} ball`);
    } catch (error: any) {
      setStatusText(error?.message || 'Otishni qayd etishda xatolik yuz berdi.');
    } finally {
      setLoading(false);
    }
  };

  const handleCameraChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value ? Number(event.target.value) : '';
    setSelectedCamera(value);
    onPlayerChange({ camera_id: typeof value === 'number' ? value : undefined });
  };

  return (
    <article className={styles.card}>
      <button className={styles.removeButton} onClick={onRemove}>
        <HiOutlineXMark />
      </button>

      <div className={styles.playerHeader}>
        <img src={currentPhoto} alt={player.name} className={styles.avatar} />
        <div>
          <strong>{player.name}</strong>
          <span>{player.nickname || 'Arena player'}</span>
        </div>
        {player.rank ? <div className={styles.rankBadge}>#{player.rank}</div> : null}
      </div>

      <div className={styles.statsGrid}>
        <div>
          <span>Jami ball</span>
          <strong>{player.total_score}</strong>
        </div>
        <div>
          <span>Oxirgi otish</span>
          <strong>{player.last_shot ?? '-'}</strong>
        </div>
        <div>
          <span>O‘rtacha</span>
          <strong>{player.average_score}</strong>
        </div>
      </div>

      <div className={styles.progressBlock}>
        <div className={styles.progressTop}>
          <span>Progress</span>
          <strong>
            {player.shots_used}/{maxShots}
          </strong>
        </div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <div className={styles.cameraBlock}>
        <div className={styles.sectionTitle}>
          <HiOutlineCamera />
          <span>Kamera</span>
        </div>
        <select value={selectedCamera} onChange={handleCameraChange}>
          <option value="">Kamera tanlang</option>
          {cameras.map((camera: Camera) => (
            <option key={camera.Id} value={camera.Id}>
              {camera.Description || `Kamera ${camera.Id}`} · {camera.IpAddress}
            </option>
          ))}
        </select>
        <div className={styles.inlineButtons}>
          <button onClick={activateSelectedCamera}>Faollashtirish</button>
          <button onClick={handleTestCapture}>Test preview</button>
        </div>
        <div className={styles.inlineButtons}>
          <button type="button" onClick={() => setShowManualForm((prev) => !prev)}>
            {showManualForm ? 'Formani yopish' : 'IP kamera qo‘shish'}
          </button>
        </div>
        {showManualForm ? (
          <div className={styles.manualCameraForm}>
            <input
              type="text"
              placeholder="Kamera nomi"
              value={manualCamera.description}
              onChange={(event) => setManualCamera((prev) => ({ ...prev, description: event.target.value }))}
            />
            <input
              type="text"
              placeholder="IP manzil, masalan 192.168.1.64"
              value={manualCamera.ip_address}
              onChange={(event) => setManualCamera((prev) => ({ ...prev, ip_address: event.target.value }))}
            />
            <div className={styles.manualGrid}>
              <input
                type="text"
                placeholder="Login"
                value={manualCamera.username}
                onChange={(event) => setManualCamera((prev) => ({ ...prev, username: event.target.value }))}
              />
              <input
                type="password"
                placeholder="Parol"
                value={manualCamera.password}
                onChange={(event) => setManualCamera((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
            <div className={styles.manualGrid}>
              <input
                type="number"
                placeholder="Port"
                value={manualCamera.port}
                onChange={(event) => setManualCamera((prev) => ({ ...prev, port: Number(event.target.value) || 554 }))}
              />
              <input
                type="text"
                placeholder="RTSP path"
                value={manualCamera.source}
                onChange={(event) => setManualCamera((prev) => ({ ...prev, source: event.target.value }))}
              />
            </div>
            <button type="button" onClick={handleManualCameraConnect} disabled={loading}>
              {loading ? 'Ulanmoqda...' : 'Qo‘shish va ulash'}
            </button>
          </div>
        ) : null}
      </div>

      <div className={styles.previewCard}>
        {frameUrl ? (
          <img src={frameUrl} alt="Preview" className={styles.previewImage} />
        ) : (
          <div className={styles.previewPlaceholder}>Preview shu yerda ko‘rinadi</div>
        )}
      </div>

      <div className={styles.shotHistory}>
        <div className={styles.sectionTitle}>
          <HiOutlineSignal />
          <span>Otishlar tarixi</span>
        </div>
        <div className={styles.scoreList}>
          {player.shots.length > 0 ? (
            player.shots.map((shot, index) => (
              <span key={`${shot}-${index}`} className={styles.scoreBadge}>
                {index + 1}: {shot}
              </span>
            ))
          ) : (
            <span className={styles.muted}>Hali natija yo‘q</span>
          )}
        </div>
      </div>

      <div className={styles.footerBlock}>
        <div className={styles.statusBox}>
          <HiOutlineTrophy />
          <span>{statusText}</span>
        </div>
        <button className={styles.captureButton} onClick={handleCapture} disabled={loading || !selectedCamera || !started}>
          <HiOutlinePlay />
          {loading ? 'Hisoblanmoqda...' : 'Otishni qayd etish'}
        </button>
      </div>
    </article>
  );
};

export default UserLayout;
