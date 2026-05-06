import { useState, useCallback, useRef } from 'react';

export interface UserMeta {
  id?: string | number;
  pnfl?: string;
  name?: string;
  photoUrl?: string;
}

export interface ExamResult {
  id: string;
  name: string;
  pnfl?: string;
  photoUrl?: string;
  examType: string;
  score: number;
  shots: number[];
}

interface UseGameScoreProps {
  user: UserMeta | null;
  onResultsUpdate: (results: ExamResult[]) => void;
}

interface UseGameScoreReturn {
  started: boolean;
  shots: number[];
  displayText: string[];
  userName: string;
  maxShots: number;
  handleStart: () => void;
  handleFinish: () => void;
  handleRestart: () => void;
  handleShoot: (score: number) => void;
  setMaxShots: (max: number) => void;
  setUserName: (name: string) => void;
}

export const useGameScore = ({ user, onResultsUpdate }: UseGameScoreProps): UseGameScoreReturn => {
  const [started, setStarted] = useState(false);
  const [shots, setShots] = useState<number[]>([]);
  const [displayText, setDisplayText] = useState<string[]>(['0']);
  const [maxShots, setMaxShotsState] = useState(8);
  const [userName, setUserNameState] = useState(user?.name || '');
  const shotsRef = useRef<number[]>([]);
  const lastResultSignatureRef = useRef<string>('');

  const handleShoot = useCallback((score: number) => {
    if (!started) return;

    const prev = shotsRef.current;
    if (prev.length >= maxShots) return;

    const nextScore = Math.max(0, Math.min(10, Number(score) || 0));
    const updated = [...prev, nextScore];
    shotsRef.current = updated;
    setShots(updated);
    setDisplayText(updated.map((shot) => `${shot}`));
  }, [started, maxShots]);

  const handleStart = useCallback(() => {
    setStarted(true);
    shotsRef.current = [];
    setShots([]);
    setDisplayText(['0']);
  }, []);

  const handleFinish = useCallback(() => {
    setStarted(false);

    const finalShots = shotsRef.current;
    if (finalShots.length === 0) return;

    const signature = `${user?.id ?? 'candidate'}-${finalShots.join(',')}`;
    if (lastResultSignatureRef.current === signature) return;

    const scoringShots = finalShots.slice(3);
    const totalScore = scoringShots.reduce((sum, current) => sum + current, 0);

    onResultsUpdate([
      {
        id: `${user?.id ?? 'candidate'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: (userName || user?.name || 'Talaba').trim(),
        pnfl: user?.pnfl,
        photoUrl: user?.photoUrl,
        examType: 'Kamon otish',
        score: totalScore,
        shots: finalShots,
      },
    ]);

    lastResultSignatureRef.current = signature;
  }, [onResultsUpdate, user?.id, user?.name, user?.photoUrl, user?.pnfl, userName]);

  const handleRestart = useCallback(() => {
    setStarted(false);
    shotsRef.current = [];
    lastResultSignatureRef.current = '';
    setShots([]);
    setDisplayText(['0']);
  }, []);

  const setMaxShots = useCallback((max: number) => {
    const normalized = Math.max(1, Math.min(20, max || 8));
    setMaxShotsState(normalized);
    setShots((prev) => {
      const sliced = prev.slice(0, normalized);
      shotsRef.current = sliced;
      return sliced;
    });
  }, []);

  const setUserName = useCallback((name: string) => {
    setUserNameState(name);
  }, []);

  return {
    started,
    shots,
    displayText,
    userName,
    maxShots,
    handleStart,
    handleFinish,
    handleRestart,
    handleShoot,
    setMaxShots,
    setUserName,
  };
};

export const useSimpleGameScore = (_user?: UserMeta | null) => {
  const [shots, setShots] = useState<number[]>([]);
  const [started, setStarted] = useState(false);
  const [displayText, setDisplayText] = useState<string[]>(['0']);

  const shoot = useCallback((score: number) => {
    if (!started) return;

    const nextScore = Math.max(0, Math.min(10, Number(score) || 0));
    setShots((prev) => {
      const updated = [...prev, nextScore];
      setDisplayText(updated.map((shot) => `${shot}`));
      return updated;
    });
  }, [started]);

  const start = useCallback(() => {
    setStarted(true);
    setShots([]);
    setDisplayText(['0']);
  }, []);

  const finish = useCallback(() => setStarted(false), []);

  const restart = useCallback(() => {
    setStarted(false);
    setShots([]);
    setDisplayText(['0']);
  }, []);

  return {
    shots,
    started,
    displayText,
    shoot,
    start,
    finish,
    restart,
  };
};
