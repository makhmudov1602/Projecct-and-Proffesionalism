import { createModel } from "@rematch/core";
import { RootModel } from ".";
import { AuthState } from "../../interfaces";

const initialState: AuthState = {
  isLogged: false,
  token: "",
  refreshToken: "",
  user_role: null,
};

export const auth = createModel<RootModel>()({
  state: initialState, 
  reducers: {
    
    login(
      state,
      { token, refreshToken }: { token: string; refreshToken: string }
    ) {
      return { ...state, token, refreshToken, isLogged: true };
    },
  },

  effects: (dispatch) => ({
    async logoutAsync() {
      dispatch({ type: "RESET_APP" });
      localStorage.removeItem("token");
    },
  }),
});
