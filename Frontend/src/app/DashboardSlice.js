import { createSlice } from '@reduxjs/toolkit';
const localData = JSON.parse(localStorage.getItem('account'));
const Dstate = JSON.parse(localStorage.getItem('dState'));
const initialState = {
  dashboardMenuState: true,
  dashboardFeature: Dstate ? Dstate : 'Home',
  account: localData ? localData : [],
  isLoggedIn: localData ? localData.isLoggedIn : false,
  profileData: [],
  adminToken: localStorage.getItem('adminToken') || null,

};

const DashboardSlice = createSlice({
  initialState,
  name: 'dashboard',
  reducers: {
    setOpenDMenu: (state, action) => {
      state.dashboardMenuState = action.payload.dashboardMenuState;
    },
    setCloseDMenu: (state, action) => {
      state.dashboardMenuState = action.payload.dashboardMenuState;
    },
    setDFeature: (state, action) => {
      state.dashboardFeature = action.payload.dashboardFeature;
      localStorage.setItem(
        'dState',
        JSON.stringify(action.payload.dashboardFeature),
      );
    },
    setAccount: (state, action) => {
      state.account = action.payload;
      state.isLoggedIn = true;
      const temp = { ...state.account, isLoggedIn: state.isLoggedIn };
      localStorage.setItem('account', JSON.stringify(temp));
    },
    LogOut: (state, action) => {
      state.account = [];
      state.profileData = [];
      state.isLoggedIn = false;
      state.dashboardMenuState = false;
      state.dashboardFeature = 'dashboard';
      localStorage.clear();
    },
    setAccountAfterRegister: (state, action) => {
      state.account = action.payload;
      state.isLoggedIn = false;
      const temp1 = { ...state.account, isLoggedIn: state.isLoggedIn };
      localStorage.setItem('account', JSON.stringify(temp1));
    },
    setAdminToken: (state, action) => {
      state.adminToken = action.payload;
      localStorage.setItem('adminToken', action.payload);
    },
    clearAdminToken: (state) => {
      state.adminToken = null;
      localStorage.removeItem('adminToken');
    },
  },
});

export const {
  setOpenDMenu,
  setCloseDMenu,
  setDFeature,
  setAccount,
  setAccountAfterRegister,
  LogOut,
  setAdminToken, clearAdminToken,
} = DashboardSlice.actions;

export const dashboardMenuState = (state) => state.dashboard.dashboardMenuState;
export const dashboardFeature = (state) => state.dashboard.dashboardFeature;
export const isUserLoggedIn = (state) => state.dashboard.isLoggedIn;
export const selectAccount = (state) => state.dashboard.account;
export const selectProfileData = (state) => state.dashboard.profileData;
export const isAdminLoggedIn = (state) => !!state.dashboard.adminToken;

export default DashboardSlice.reducer;
