export type PersonApi = {
    Pnfl: string;
    FirstName: string;
    LastName: string;
    Patronymic: string;
    PhotoBase64?: string | null;
};

export type Person = {
    pnfl: string;
    firstName: string;
    lastName: string;
    patronymic: string;
    photoBase64?: string | null;
};

type PersonsState = {
    list: Person[];
    byPnfl: Record<string, Person>;
    status: "idle" | "loading" | "succeeded" | "failed";
    error?: string | null;
    lastLoadedAt?: number | null;
};

const initialState: PersonsState = {
    list: [],
    byPnfl: {},
    status: "idle",
    error: null,
    lastLoadedAt: null,
};

const API_BASE = "http://127.0.0.1:8000";

const normalize = (p: PersonApi): Person => ({
    pnfl: (p.Pnfl ?? "").trim(),
    firstName: (p.FirstName ?? "").trim(),
    lastName: (p.LastName ?? "").trim(),
    patronymic: (p.Patronymic ?? "").trim(),
    photoBase64: p.PhotoBase64 ?? null,
});

function extractArray(payload: any): PersonApi[] {
    if (Array.isArray(payload)) return payload;
    if (payload?.results && Array.isArray(payload.results)) return payload.results;
    if (payload?.data && Array.isArray(payload.data)) return payload.data;
    if (payload?.items && Array.isArray(payload.items)) return payload.items;
    return [];
}

async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, ms = 12000) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(input, { ...init, signal: ctrl.signal });
    } finally {
        clearTimeout(id);
    }
}

export const persons = {
    state: initialState,
    reducers: {
        setLoading(state: PersonsState) {
            return { ...state, status: "loading", error: null };
        },
        setFailed(state: PersonsState, payload: string) {
            return { ...state, status: "failed", error: payload };
        },
        setSucceeded(state: PersonsState, payload: Person[]) {
            const byPnfl = payload.reduce<Record<string, Person>>((acc, p) => {
                if (p.pnfl) acc[p.pnfl] = p;
                return acc;
            }, {});
            return {
                ...state,
                status: "succeeded",
                error: null,
                list: payload,
                byPnfl,
                lastLoadedAt: Date.now(),
            };
        },
        upsertOne(state: PersonsState, payload: Person) {
            const existing = state.byPnfl[payload.pnfl];
            const byPnfl = { ...state.byPnfl, [payload.pnfl]: { ...(existing || {}), ...payload } };
            const idx = state.list.findIndex((x) => x.pnfl === payload.pnfl);
            const list =
                idx === -1
                    ? [...state.list, payload]
                    : [...state.list.slice(0, idx), { ...state.list[idx], ...payload }, ...state.list.slice(idx + 1)];
            return { ...state, byPnfl, list };
        },
    },
    effects: (dispatch: any) => ({
        async loadAll(_: void, rootState: any) {
            const st: PersonsState | undefined = rootState?.persons;
            if (st && st.status === "succeeded" && st.list.length > 0) {
                console.log("[persons.loadAll] already loaded; length:", st.list.length);
                return;
            }
            dispatch.persons.setLoading();
            try {
                const url = `${API_BASE}/api/persons/?limit=3500&offset=0`;
                console.log("[persons.loadAll] GET", url);
                const res = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
                console.log("[persons.loadAll] status:", res.status);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const raw = await res.json();
                console.log("[persons.loadAll] raw payload:", raw);
                const data: PersonApi[] = extractArray(raw);
                console.log("[persons.loadAll] parsed array length:", data.length, "sample:", data[0]);
                const normalized = data.map(normalize);
                dispatch.persons.setSucceeded(normalized);
            } catch (e: any) {
                console.log("[persons.loadAll] error:", e?.name, e?.message);
                const msg =
                    e?.name === "AbortError"
                        ? "So‘rov vaqt bo‘yicha to‘xtatildi (timeout). API/CORS tekshiring."
                        : e?.message || "Failed to load persons";
                dispatch.persons.setFailed(msg);
            }
        },

        async fetchOneByPnfl(pnfl: string) {
            const url = `${API_BASE}/api/persons/get?pnfl=${encodeURIComponent(pnfl)}`;
            console.log("[persons.fetchOneByPnfl] POST", url);
            try {
                const res = await fetchWithTimeout(url, { method: "POST", headers: { Accept: "application/json" } });
                console.log("[persons.fetchOneByPnfl] status:", res.status);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const raw = await res.json();
                console.log("[persons.fetchOneByPnfl] raw:", raw);
                const person = normalize(raw as PersonApi);
                dispatch.persons.upsertOne(person);
                return person as Person;
            } catch (e: any) {
                console.log("[persons.fetchOneByPnfl] error:", e?.name, e?.message);
                return null;
            }
        },
    }),
};
