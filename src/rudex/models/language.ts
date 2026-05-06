import { createModel } from "@rematch/core";
import { RootModel } from ".";

const initialState = {
  lng: "uz",
};

const language = createModel<RootModel>()({
  state: initialState, 
  reducers: {
    changeLanguage(state, payload) {
      return {
        ...state,
        lng: payload,
      };
    },
  },
  effects: (_dispatch) => ({}),
});

export default language;
