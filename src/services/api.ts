import axios from 'axios';

const AI_BASE_URL = 'http://localhost:8000/ai';
const ARENA_BASE_URL = 'http://localhost:8000/arena';

export interface Camera {
  Id: number;
  Description: string;
  IpAddress: string;
  Port: number;
  Username: string;
  PasswordHash: string;
  Source: string;
  BranchId: number;
  CreatedAt: string | number;
  UpdatedAt: string | number;
  is_manual?: boolean;
}

export interface ManualCameraPayload {
  description: string;
  ip_address: string;
  username: string;
  password: string;
  port?: number;
  source?: string;
  auto_start?: boolean;
}

export interface Region {
  Id: number;
  Name: string;
  Description?: string;
}

export interface Branch {
  Id: number;
  Name: string;
  RegionId: number;
  Description?: string;
}

export interface HealthCheck {
  status: string;
  model_loaded: boolean;
  active_sessions: number;
  active_camera: number | null;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
}

export type GameMode = 'archery' | 'rifle';
export type SessionStatus = 'waiting' | 'active' | 'finished';

export interface ArenaPlayer {
  id: string;
  name: string;
  nickname?: string;
  photo_url?: string;
  camera_id?: number | null;
  shots: number[];
  shots_used: number;
  total_score: number;
  average_score: number;
  last_shot?: number | null;
  best_shot: number;
  tens_count: number;
  hit_count: number;
  rank?: number;
  remaining_shots?: number;
  is_finished?: boolean;
}

export interface ArenaSessionSummary {
  id: string;
  title: string;
  mode: GameMode;
  max_shots: number;
  location?: string;
  status: SessionStatus;
  player_count: number;
  players: ArenaPlayer[];
  winner?: ArenaPlayer | null;
  shots: ArenaShotRecord[];
  created_at: number;
  started_at?: number | null;
  finished_at?: number | null;
}

export interface ArenaShotRecord {
  id: string;
  player_id: string;
  player_name: string;
  camera_id: number;
  mode: GameMode;
  shot_index: number;
  score: number;
  ring?: number;
  x?: number;
  y?: number;
  x_rel?: number;
  y_rel?: number;
  timestamp: number;
}

export interface DetectionPoint {
  x?: number;
  y?: number;
  x_rel?: number;
  y_rel?: number;
  score?: number;
  conf?: number;
  ring?: number;
}

export interface ArenaCaptureResponse {
  status: string;
  session_id: string;
  mode: GameMode;
  player: ArenaPlayer;
  accepted_scores: number[];
  accepted_points: DetectionPoint[];
  visualization?: {
    image: string;
    mime_type: string;
    size: [number, number];
  } | null;
  histogram: {
    total_shots: number;
    average_score: number;
    histogram: Record<string, number>;
    distribution: Record<string, number>;
  };
  scoreboard: ArenaPlayer[];
  winner?: ArenaPlayer | null;
  session_status: SessionStatus;
  remaining_shots: number;
  profile: string;
}

interface OfflineSession {
  session: ArenaSessionSummary;
}

const offlineArenaStore: Record<string, OfflineSession> = {};

const rankPlayers = (players: ArenaPlayer[], maxShots: number) => {
  return [...players]
    .sort((a, b) => b.total_score - a.total_score || b.tens_count - a.tens_count || b.best_shot - a.best_shot || a.name.localeCompare(b.name))
    .map((player, index) => ({
      ...player,
      rank: index + 1,
      remaining_shots: Math.max(0, maxShots - player.shots_used),
      is_finished: player.shots_used >= maxShots,
    }));
};

const computePlayer = (player: Partial<ArenaPlayer> & { id: string; name: string }): ArenaPlayer => {
  const shots = [...(player.shots || [])];
  const total_score = shots.reduce((sum, value) => sum + value, 0);
  return {
    id: player.id,
    name: player.name,
    nickname: player.nickname,
    photo_url: player.photo_url,
    camera_id: player.camera_id ?? null,
    shots,
    shots_used: shots.length,
    total_score,
    average_score: shots.length ? Math.round((total_score / shots.length) * 100) / 100 : 0,
    last_shot: shots.length ? shots[shots.length - 1] : null,
    best_shot: shots.length ? Math.max(...shots) : 0,
    tens_count: shots.filter((shot) => shot === 10).length,
    hit_count: shots.length,
  };
};

const buildOfflineScoreboard = (session: ArenaSessionSummary) => {
  const players = rankPlayers(session.players.map((player) => computePlayer(player)), session.max_shots);
  session.players = players;
  session.player_count = players.length;
  session.winner = players[0] ?? null;
  return players;
};

const createOfflineSession = (payload: {
  title: string;
  mode: GameMode;
  max_shots: number;
  location?: string;
}): ArenaSessionSummary => {
  const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const session: ArenaSessionSummary = {
    id,
    title: payload.title,
    mode: payload.mode,
    max_shots: payload.max_shots,
    location: payload.location,
    status: 'waiting',
    player_count: 0,
    players: [],
    winner: null,
    shots: [],
    created_at: Date.now() / 1000,
    started_at: null,
    finished_at: null,
  };
  offlineArenaStore[id] = { session };
  return session;
};

const offlineHistogram = (scores: number[]) => {
  const histogram = scores.reduce<Record<string, number>>((acc, score) => {
    const key = String(score);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const total = scores.length;
  return {
    total_shots: total,
    average_score: total ? scores.reduce((sum, score) => sum + score, 0) / total : 0,
    histogram,
    distribution: Object.fromEntries(Object.entries(histogram).map(([key, value]) => [key, total ? (value / total) * 100 : 0])),
  };
};

export const getCameras = async (params?: { skip?: number; limit?: number }): Promise<Camera[]> => {
  try {
    const response = await axios.get(`${AI_BASE_URL}/cameras`, { params });
    return response.data;
  } catch {
    return [
      {
        Id: 1,
        Description: 'Arena kamera 1',
        IpAddress: '192.168.1.10',
        Port: 554,
        Username: 'admin',
        PasswordHash: 'admin123',
        Source: '/Streaming/Channels/101',
        BranchId: 1,
        CreatedAt: '2025-01-01T00:00:00',
        UpdatedAt: '2025-01-01T00:00:00',
      },
      {
        Id: 2,
        Description: 'Arena kamera 2',
        IpAddress: '192.168.1.11',
        Port: 554,
        Username: 'admin',
        PasswordHash: 'admin123',
        Source: '/Streaming/Channels/101',
        BranchId: 1,
        CreatedAt: '2025-01-01T00:00:00',
        UpdatedAt: '2025-01-01T00:00:00',
      },
    ];
  }
};

export const getRegions = async (_params?: { skip?: number; limit?: number }): Promise<Region[]> => [
  { Id: 1, Name: 'Ochiq arena' },
  { Id: 2, Name: 'Yopiq tir zonasi' },
];

export const getBranches = async (_params?: { skip?: number; limit?: number }): Promise<Branch[]> => [
  { Id: 1, Name: 'Asosiy maydon', RegionId: 1 },
  { Id: 2, Name: 'Mashg‘ulot yo‘lagi', RegionId: 2 },
];

export const login = async (_data: { username: string; password: string }): Promise<LoginResponse> => ({
  token: 'demo-token',
  refreshToken: 'demo-refresh-token',
});

export const getUser = async (): Promise<any> => ({
  id: 'demo-user',
  name: 'Arena operatori',
  role: 'operator',
});

export const addManualCamera = async (payload: ManualCameraPayload): Promise<{ status: string; camera: Camera; rtsp_url_preview?: string }> => {
  try {
    const response = await axios.post(`${AI_BASE_URL}/cameras/manual-connect`, {
      description: payload.description,
      ip_address: payload.ip_address,
      username: payload.username,
      password: payload.password,
      port: payload.port ?? 554,
      source: payload.source ?? '/Streaming/Channels/101',
      auto_start: payload.auto_start ?? true,
    });
    return response.data;
  } catch {
    const camera: Camera = {
      Id: Math.floor(9000 + Math.random() * 1000),
      Description: payload.description || 'Manual kamera',
      IpAddress: payload.ip_address,
      Port: payload.port ?? 554,
      Username: payload.username || 'admin',
      PasswordHash: payload.password || '',
      Source: payload.source ?? '/Streaming/Channels/101',
      BranchId: 1,
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
      is_manual: true,
    };
    return { status: 'saved-offline', camera };
  }
};

export const activateCamera = async (cameraId: number): Promise<any> => {
  try {
    const response = await axios.post(`${AI_BASE_URL}/cameras/${cameraId}/activate`);
    return response.data;
  } catch {
    return { status: 'activated', camera_id: cameraId, offline: true };
  }
};

export const clearBaseline = async (cameraId: number): Promise<any> => {
  try {
    const response = await axios.post(`${AI_BASE_URL}/cameras/${cameraId}/clear-baseline`);
    return response.data;
  } catch {
    return { status: 'cleared', camera_id: cameraId, offline: true };
  }
};

export const testCapture = async (cameraId: number): Promise<string> => {
  try {
    const response = await axios.get(`${AI_BASE_URL}/cameras/${cameraId}/test-capture`, {
      responseType: 'blob',
      timeout: 15000,
    });
    return URL.createObjectURL(response.data);
  } catch {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 420;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0, 0, 640, 420);
      const colors = ['#f3f4f6', '#fbbf24', '#ef4444', '#60a5fa'];
      for (let i = 0; i < 8; i++) {
        ctx.strokeStyle = colors[i % colors.length];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(320, 210, 140 - i * 14, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Kamera ${cameraId}`, 320, 40);
      ctx.font = '16px Arial';
      ctx.fillText('Test vizualizatsiya', 320, 385);
    }
    return canvas.toDataURL('image/jpeg');
  }
};

export const healthCheck = async (): Promise<HealthCheck> => {
  try {
    const response = await axios.get(`${AI_BASE_URL}/health`, { timeout: 5000 });
    return response.data;
  } catch {
    return {
      status: 'offline-demo',
      model_loaded: false,
      active_sessions: 0,
      active_camera: null,
    };
  }
};

export const createArenaSession = async (payload: {
  title: string;
  mode: GameMode;
  maxShots: number;
  location?: string;
}): Promise<{ status: string; session: ArenaSessionSummary }> => {
  try {
    const response = await axios.post(`${ARENA_BASE_URL}/sessions`, {
      title: payload.title,
      mode: payload.mode,
      max_shots: payload.maxShots,
      location: payload.location,
    });
    return response.data;
  } catch {
    const session = createOfflineSession({
      title: payload.title,
      mode: payload.mode,
      max_shots: payload.maxShots,
      location: payload.location,
    });
    return { status: 'created-offline', session };
  }
};

export const listArenaSessions = async (): Promise<ArenaSessionSummary[]> => {
  try {
    const response = await axios.get(`${ARENA_BASE_URL}/sessions`);
    return response.data;
  } catch {
    return Object.values(offlineArenaStore).map((item) => item.session);
  }
};

export const addArenaPlayer = async (
  sessionId: string,
  payload: { name: string; nickname?: string; photo_url?: string; camera_id?: number | null }
): Promise<{ status: string; player: ArenaPlayer; session: ArenaSessionSummary }> => {
  try {
    const response = await axios.post(`${ARENA_BASE_URL}/sessions/${sessionId}/players`, payload);
    return response.data;
  } catch {
    const offline = offlineArenaStore[sessionId] || { session: createOfflineSession({ title: 'Offline Session', mode: 'archery', max_shots: 5 }) };
    const player = computePlayer({
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      name: payload.name,
      nickname: payload.nickname,
      photo_url: payload.photo_url,
      camera_id: payload.camera_id ?? null,
      shots: [],
    });
    offline.session.players.push(player);
    buildOfflineScoreboard(offline.session);
    offlineArenaStore[offline.session.id] = offline;
    return { status: 'player-added-offline', player, session: offline.session };
  }
};

export const startArenaSession = async (sessionId: string): Promise<{ status: string; session: ArenaSessionSummary }> => {
  try {
    const response = await axios.post(`${ARENA_BASE_URL}/sessions/${sessionId}/start`);
    return response.data;
  } catch {
    const session = offlineArenaStore[sessionId]?.session;
    if (!session) throw new Error('Session topilmadi');
    session.status = 'active';
    session.started_at = Date.now() / 1000;
    return { status: 'started-offline', session };
  }
};

export const finishArenaSession = async (sessionId: string): Promise<{ status: string; session: ArenaSessionSummary }> => {
  try {
    const response = await axios.post(`${ARENA_BASE_URL}/sessions/${sessionId}/finish`);
    return response.data;
  } catch {
    const session = offlineArenaStore[sessionId]?.session;
    if (!session) throw new Error('Session topilmadi');
    session.status = 'finished';
    session.finished_at = Date.now() / 1000;
    buildOfflineScoreboard(session);
    return { status: 'finished-offline', session };
  }
};

export const getArenaScoreboard = async (sessionId: string): Promise<{ session_id: string; title: string; mode: GameMode; status: SessionStatus; max_shots: number; scoreboard: ArenaPlayer[]; winner?: ArenaPlayer | null }> => {
  try {
    const response = await axios.get(`${ARENA_BASE_URL}/sessions/${sessionId}/scoreboard`);
    return response.data;
  } catch {
    const session = offlineArenaStore[sessionId]?.session;
    if (!session) throw new Error('Session topilmadi');
    const scoreboard = buildOfflineScoreboard(session);
    return {
      session_id: session.id,
      title: session.title,
      mode: session.mode,
      status: session.status,
      max_shots: session.max_shots,
      scoreboard,
      winner: scoreboard[0] ?? null,
    };
  }
};

export const captureArenaShot = async (
  sessionId: string,
  playerId: string,
  payload: { camera_id: number; shot_count?: number; mode?: GameMode }
): Promise<ArenaCaptureResponse> => {
  try {
    const response = await axios.post(`${ARENA_BASE_URL}/sessions/${sessionId}/players/${playerId}/capture`, payload);
    return response.data;
  } catch {
    const session = offlineArenaStore[sessionId]?.session;
    if (!session) throw new Error('Session topilmadi');
    const mode = payload.mode || session.mode;
    const player = session.players.find((item) => item.id === playerId);
    if (!player) throw new Error('Ishtirokchi topilmadi');
    const randomScore = mode === 'rifle' ? 6 + Math.floor(Math.random() * 5) : 4 + Math.floor(Math.random() * 7);
    const updatedPlayer = computePlayer({ ...player, shots: [...player.shots, randomScore], camera_id: payload.camera_id });
    const shot: ArenaShotRecord = {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      player_id: updatedPlayer.id,
      player_name: updatedPlayer.name,
      camera_id: payload.camera_id,
      mode,
      shot_index: updatedPlayer.shots.length,
      score: randomScore,
      ring: 11 - randomScore,
      x: 320,
      y: 240,
      x_rel: 0.5,
      y_rel: 0.5,
      timestamp: Date.now() / 1000,
    };
    session.players = session.players.map((item) => (item.id === playerId ? updatedPlayer : computePlayer(item)));
    session.shots.push(shot);
    const scoreboard = buildOfflineScoreboard(session);
    const finalPlayer = scoreboard.find((item) => item.id === playerId) || updatedPlayer;
    if (scoreboard.every((item) => item.shots_used >= session.max_shots)) {
      session.status = 'finished';
      session.finished_at = Date.now() / 1000;
    }
    return {
      status: 'captured-offline',
      session_id: session.id,
      mode,
      player: finalPlayer,
      accepted_scores: [randomScore],
      accepted_points: [{ x: 320, y: 240, x_rel: 0.5, y_rel: 0.5, score: randomScore, ring: 11 - randomScore, conf: 0.92 }],
      visualization: null,
      histogram: offlineHistogram(finalPlayer.shots),
      scoreboard,
      winner: scoreboard[0] ?? null,
      session_status: session.status,
      remaining_shots: Math.max(0, session.max_shots - finalPlayer.shots_used),
      profile: mode,
    };
  }
};

const API = {
  getCameras,
  getRegions,
  getBranches,
  login,
  getUser,
  addManualCamera,
  activateCamera,
  clearBaseline,
  testCapture,
  healthCheck,
  createArenaSession,
  listArenaSessions,
  addArenaPlayer,
  startArenaSession,
  finishArenaSession,
  getArenaScoreboard,
  captureArenaShot,
};

export { API };
export default API;
