// import { create } from 'zustand';

// interface GameState {
//   score: number[];
//   started: boolean;
//   shots: number;
//   maxShots: number;
//   resetKey: number;
//   showModal: boolean;
//   results: any[];
//   showTable: boolean;
//   userName: string;
//   displayText: string[];

//   // Actions
//   setScore: (score: number[]) => void;
//   setStarted: (started: boolean) => void;
//   setShots: (shots: number) => void;
//   setMaxShots: (maxShots: number) => void;
//   setResetKey: (resetKey: number) => void;
//   setShowModal: (showModal: boolean) => void;
//   setResults: (results: any[]) => void;
//   setShowTable: (showTable: boolean) => void;
//   setUserName: (userName: string) => void;
//   setDisplayText: (displayText: string[]) => void;

//   handleStart: () => void;
//   handleFinish: () => void;
//   handleRestart: () => void;
//   handleShoot: (shotScore: number) => void;
//   handleModalClose: () => void;
// }

// export const useGameStore = create<GameState>((set) => ({
//   // Initial state
//   score: [],
//   started: false,
//   shots: 0,
//   maxShots: 10,
//   resetKey: 0,
//   showModal: false,
//   results: [],
//   showTable: false,
//   userName: "",
//   displayText: [],

//   // Setters
//   setScore: (score) => set({ score }),
//   setStarted: (started) => set({ started }),
//   setShots: (shots) => set({ shots }),
//   setMaxShots: (maxShots) => set({ maxShots }),
//   setResetKey: (resetKey) => set({ resetKey }),
//   setShowModal: (showModal) => set({ showModal }),
//   setResults: (results) => set({ results }),
//   setShowTable: (showTable) => set({ showTable }),
//   setUserName: (userName) => set({ userName }),
//   setDisplayText: (displayText) => set({ displayText }),

//   // Actions
//   handleStart: () => set((state) => ({
//     started: true,
//     score: [],
//     shots: 0,
//     resetKey: state.resetKey + 1,
//     displayText: ["Game started!"]
//   })),

//   handleFinish: () => set({
//     started: false,
//     showModal: true
//   }),

//   handleRestart: () => set((state) => ({
//     started: false,
//     score: [],
//     shots: 0,
//     resetKey: state.resetKey + 1,
//     displayText: ["Ready to start"],
//     showModal: false,
//     showTable: false
//   })),

//   handleShoot: (shotScore) => set((state) => {
//     if (!state.started || state.shots >= state.maxShots) return state;

//     const newScore = [...state.score, shotScore];
//     const newShots = state.shots + 1;
//     const newDisplayText = [...state.displayText, `Shot ${state.shots + 1}: ${shotScore} points`];

//     const newState = {
//       score: newScore,
//       shots: newShots,
//       displayText: newDisplayText
//     };

//     if (newShots >= state.maxShots) {
//       return {
//         ...newState,
//         started: false,
//         showModal: true
//       };
//     }

//     return newState;
//   }),

//   handleModalClose: () => set({
//     showModal: false,
//     showTable: true
//   }),
// }));