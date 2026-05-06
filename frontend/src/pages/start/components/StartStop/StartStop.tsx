import { HiOutlineFlag, HiOutlinePlay, HiOutlineStop, HiOutlineArrowPath } from 'react-icons/hi2';
import type { GameMode } from '@/services/api';
import styles from './StartStop.module.scss';

interface SessionConfig {
  title: string;
  mode: GameMode;
  maxShots: number;
  location: string;
}

interface Props {
  started: boolean;
  participantCount: number;
  sessionStatus: string;
  config: SessionConfig;
  onConfigChange: (patch: Partial<SessionConfig>) => void;
  handleStart: () => void;
  handleRestart: () => void;
  handleFinish: () => void;
}

const StartStop = ({
  started,
  participantCount,
  sessionStatus,
  config,
  onConfigChange,
  handleStart,
  handleRestart,
  handleFinish,
}: Props) => {
  return (
    <section className={styles.controlPanel}>
      <div className={styles.heading}>
        <div>
          <span className={styles.badge}>Session setup</span>
          <h3>O‘yin sessiyasini sozlash</h3>
          <p>Kamon yoki tir rejimini tanlang, ishtirokchilarni qo‘shing va live scoreboardni ishga tushiring.</p>
        </div>
        <div className={styles.statusCard}>
          <span>Holat</span>
          <strong>{sessionStatus}</strong>
        </div>
      </div>

      <div className={styles.grid}>
        <label>
          <span>Sessiya nomi</span>
          <input value={config.title} onChange={(e) => onConfigChange({ title: e.target.value })} />
        </label>

        <label>
          <span>Rejim</span>
          <select value={config.mode} onChange={(e) => onConfigChange({ mode: e.target.value as GameMode })}>
            <option value="archery">Archery</option>
            <option value="rifle">Rifle / Tir</option>
          </select>
        </label>

        <label>
          <span>Maksimal otishlar</span>
          <input
            type="number"
            min={1}
            max={20}
            value={config.maxShots}
            onChange={(e) => onConfigChange({ maxShots: Number(e.target.value) || 5 })}
          />
        </label>

        <label>
          <span>Joy</span>
          <input value={config.location} onChange={(e) => onConfigChange({ location: e.target.value })} />
        </label>
      </div>

      <div className={styles.quickStats}>
        <div>
          <span>Ishtirokchilar</span>
          <strong>{participantCount}</strong>
        </div>
        <div>
          <span>Format</span>
          <strong>{config.mode === 'archery' ? 'Kamon' : 'Tir'}</strong>
        </div>
        <div>
          <span>Bir o‘yinchi limiti</span>
          <strong>{config.maxShots} ta otish</strong>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.startButton} onClick={handleStart} disabled={participantCount === 0}>
          <HiOutlinePlay />
          {started ? 'Sessiya faol' : 'Sessiyani boshlash'}
        </button>
        <button className={styles.resetButton} onClick={handleRestart}>
          <HiOutlineArrowPath />
          Qayta tayyorlash
        </button>
        <button className={styles.finishButton} onClick={handleFinish} disabled={!started}>
          <HiOutlineFlag />
          Yakunlash
        </button>
        <div className={styles.tipBox}>
          <HiOutlineStop />
          Sessiya yakunida leaderboard avtomatik saqlanadi.
        </div>
      </div>
    </section>
  );
};

export default StartStop;
