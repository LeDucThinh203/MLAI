import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../api/client';

const AuthContext = createContext();
let csrfToken = null;
export const getCsrfToken = () => csrfToken;
const rememberCsrfToken = (value) => { csrfToken = value || null; };

// JWTs live only in HttpOnly cookies. Remove legacy bearer headers and attach
// credentials plus the non-secret CSRF value on every Axios request.
axios.defaults.withCredentials = true;
axios.interceptors.request.use((config) => {
  config.withCredentials = true;
  if (config.headers) {
    delete config.headers.Authorization;
    delete config.headers.authorization;
  }
  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method) && csrfToken) {
    config.headers = { ...config.headers, 'X-CSRF-Token': csrfToken };
  }
  return config;
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/me`);
      if (res.data?.success && res.data?.data?.user) {
        rememberCsrfToken(res.data.data.csrfToken);
        setUser(res.data.data.user);
        setToken(true); // session flag only; the JWT remains HttpOnly.
        return true;
      } else {
        return false;
      }
    } catch {
      return false;
    }
  };

  const tryRefreshToken = async () => {
    try {
      const res = await axios.post(`${API_BASE}/auth/refresh`, {});
      if (res.data?.success && res.data.data?.user) {
        rememberCsrfToken(res.data.data.csrfToken);
        setUser(res.data.data.user);
        setToken(true);
        return true;
      } else {
        clearLocalSession();
      }
    } catch {
      clearLocalSession();
    }
    return false;
  };

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const csrfResponse = await axios.get(`${API_BASE}/auth/csrf`);
        const session = csrfResponse.data?.data;
        if (session?.hasSession) {
          rememberCsrfToken(session.csrfToken);
          if (!(await fetchMe())) await tryRefreshToken();
        }
      } catch {
        // Treat a temporarily unavailable API exactly like a signed-out state.
      }
      setLoading(false);
    };
    restoreSession();
  }, []);

  const login = async (username, password) => {
    try {
      const res = await axios.post(`${API_BASE}/login`, { username, password });
      if (res.data?.success) {
        if (res.data.data?.requires2FA) {
          return {
            success: true,
            requires2FA: true,
            tempToken: res.data.data.tempToken,
            username: res.data.data.username,
            maskedEmail: res.data.data.maskedEmail
          };
        }
        const { user: userData } = res.data.data;
        rememberCsrfToken(res.data.data.csrfToken);
        setUser(userData);
        setToken(true);
        return { success: true, user: userData };
      }
      return { success: false, message: res.data?.message || 'Đăng nhập thất bại' };
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể kết nối đến máy chủ!';
      return { success: false, message: msg };
    }
  };

  const login2FA = async (tempToken, otpCode) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/2fa/login`, { tempToken, otpCode });
      if (res.data?.success) {
        const { user: userData } = res.data.data;
        rememberCsrfToken(res.data.data.csrfToken);
        setUser(userData);
        setToken(true);
        return { success: true, user: userData };
      }
      return { success: false, message: res.data?.message || 'Xác thực OTP thất bại' };
    } catch (err) {
      const msg = err.response?.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn!';
      return { success: false, message: msg };
    }
  };

  const registerStudent = async (studentData) => {
    try {
      const res = await axios.post(`${API_BASE}/register`, studentData);
      if (res.data?.success) {
        const { user: userProfile } = res.data.data;
        rememberCsrfToken(res.data.data.csrfToken);
        setUser(userProfile);
        setToken(true);
        return { success: true, user: userProfile, message: res.data.message };
      }
      return { success: false, message: res.data?.message || 'Đăng ký thất bại' };
    } catch (err) {
      const msg = err.response?.data?.message || 'Lỗi đăng ký tài khoản!';
      return { success: false, message: msg };
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const res = await axios.put(`${API_BASE}/auth/profile`, profileData);
      if (res.data?.success && res.data?.data?.user) {
        setUser(prev => ({ ...prev, ...res.data.data.user }));
        return { success: true, user: res.data.data.user, message: res.data.message || 'Cập nhật thông tin thành công!' };
      }
      return { success: false, message: res.data?.message || 'Cập nhật thất bại' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi cập nhật hồ sơ' };
    }
  };

  const uploadAvatar = async (formData) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success && res.data?.data?.user) {
        setUser(prev => ({ ...prev, ...res.data.data.user }));
        return { success: true, avatar: res.data.data.avatar, message: res.data.message };
      }
      return { success: false, message: res.data?.message || 'Tải ảnh đại diện thất bại' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi tải ảnh đại diện' };
    }
  };

  const changePassword = async (oldPassword, newPassword, confirmPassword) => {
    try {
      const res = await axios.put(`${API_BASE}/auth/change-password`, {
        oldPassword,
        newPassword,
        confirmPassword
      });
      return { success: res.data?.success, message: res.data?.message || 'Đổi mật khẩu thành công' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi đổi mật khẩu' };
    }
  };

  const deleteAccount = async (password) => {
    try {
      const res = await axios.delete(`${API_BASE}/auth/account`, { data: { password } });
      if (res.data?.success) {
        logout();
        return { success: true, message: res.data.message };
      }
      return { success: false, message: res.data?.message || 'Xóa tài khoản thất bại' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi xóa tài khoản' };
    }
  };

  const generate2FA = async () => {
    try {
      const res = await axios.post(`${API_BASE}/auth/2fa/generate`, {});
      return res.data;
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi tạo mã 2FA' };
    }
  };

  const enable2FA = async (secret, otpCode) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/2fa/enable`, { secret, otpCode });
      if (res.data?.success) {
        setUser(prev => ({ ...prev, twoFactorEnabled: true }));
      }
      return res.data;
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Mã OTP không đúng' };
    }
  };

  const disable2FA = async (otpCode) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/2fa/disable`, { otpCode });
      if (res.data?.success) {
        setUser(prev => ({ ...prev, twoFactorEnabled: false }));
      }
      return res.data;
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Mã OTP không đúng' };
    }
  };

  const clearLocalSession = () => {
    rememberCsrfToken(null);
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const logout = async () => {
    // Revoke the server-side refresh token first. Local cleanup still runs if
    // the network is unavailable, so the current browser session always ends.
    try {
      await axios.post(`${API_BASE}/auth/logout`, {});
    } catch {
      // A failed revocation must not keep the user signed in on this device.
    } finally {
      clearLocalSession();
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      refreshToken,
      loading,
      login,
      login2FA,
      registerStudent,
      updateProfile,
      uploadAvatar,
      changePassword,
      deleteAccount,
      generate2FA,
      enable2FA,
      disable2FA,
      fetchMe,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
