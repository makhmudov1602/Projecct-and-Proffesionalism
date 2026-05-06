import { init, RematchDispatch, RematchRootState } from "@rematch/core";
import createPersistPlugin from "@rematch/persist";
import storage from "redux-persist/lib/storage";
import { models, RootModel } from "./models";

const persistPlugin: any = createPersistPlugin({
  key: "root",
  storage,
  version: 2,
  whitelist: ["auth", "userData", "language", "persons"], // include persons
});

export const store = init({
  models,
  redux: {
    middlewares: [],
    enhancers: [],
    rootReducers: { RESET_APP: () => undefined },
  },
  plugins: [persistPlugin],
});

export type Dispatch = RematchDispatch<RootModel>;
export type RootState = RematchRootState<RootModel>;

// ✅ Export both — this matches your Axios code pattern
export const dispatch = store.dispatch as Dispatch;
export const getState = store.getState as () => RootState;
