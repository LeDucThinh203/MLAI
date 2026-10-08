import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('cf_token') || null);
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('cf_refresh_token') || null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async (savedToken = token) => {
    if (!savedToken) {
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      });
      if (res.data?.success && res.data?.data?.user) {
        setUser(res.data.data.user);
        setToken(savedToken);
      } else {
        await tryRefreshToken();
      }
    } catch {
      await tryRefreshToken();
    } finally {
      setLoading(false);
    }
  };

  const tryRefreshToken = async () => {
    const savedRefresh = localStorage.getItem('cf_refresh_token');
    if (!savedRefresh) {
      logout();
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken: savedRefresh });
      if (res.data?.success && res.data.data?.token) {
        const newToken = res.data.data.token;
        const newRefresh = res.data.data.refreshToken || savedRefresh;
        setToken(newToken);
        setRefreshToken(newRefresh);
        localStorage.setItem('cf_token', newToken);
        localStorage.setItem('cf_refresh_token', newRefresh);
        const meRes = await axios.get(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${newToken}` }
        });
        if (meRes.data?.success) {
          setUser(meRes.data.data.user);
        }
      } else {
        logout();
      }
    } catch {
      logout();
    }
  };

  useEffect(() => {
    const savedToken = localStorage.getItem('cf_token');
    fetchMe(savedToken);
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
        const { token: newToken, refreshToken: newRefresh, user: userData } = res.data.data;
        setToken(newToken);
        if (newRefresh) {
          setRefreshToken(newRefresh);
          localStorage.setItem('cf_refresh_token', newRefresh);
        }
        setUser(userData);
        localStorage.setItem('cf_token', newToken);
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
        const { token: newToken, refreshToken: newRefresh, user: userData } = res.data.data;
        setToken(newToken);
        if (newRefresh) {
          setRefreshToken(newRefresh);
          localStorage.setItem('cf_refresh_token', newRefresh);
        }
        setUser(userData);
        localStorage.setItem('cf_token', newToken);
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
        const { token: newToken, refreshToken: newRefresh, user: userProfile } = res.data.data;
        setToken(newToken);
        if (newRefresh) {
          setRefreshToken(newRefresh);
          localStorage.setItem('cf_refresh_token', newRefresh);
        }
        setUser(userProfile);
        localStorage.setItem('cf_token', newToken);
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
      const res = await axios.put(`${API_BASE}/auth/profile`, profileData, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
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
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { success: res.data?.success, message: res.data?.message || 'Đổi mật khẩu thành công' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi đổi mật khẩu' };
    }
  };

  const deleteAccount = async (password) => {
    try {
      const res = await axios.delete(`${API_BASE}/auth/account`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { password }
      });
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
      const res = await axios.post(`${API_BASE}/auth/2fa/generate`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Lỗi tạo mã 2FA' };
    }
  };

  const enable2FA = async (secret, otpCode) => {
    try {
      const res = await axios.post(`${API_BASE}/auth/2fa/enable`, { secret, otpCode }, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const res = await axios.post(`${API_BASE}/auth/2fa/disable`, { otpCode }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setUser(prev => ({ ...prev, twoFactorEnabled: false }));
      }
      return res.data;
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Mã OTP không đúng' };
    }
  };

  const clearLocalSession = () => {
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    localStorage.removeItem('cf_token');
    localStorage.removeItem('cf_refresh_token');
  };

  const logout = async () => {
    // Revoke the server-side refresh token first. Local cleanup still runs if
    // the network is unavailable, so the current browser session always ends.
    const activeRefreshToken = refreshToken || localStorage.getItem('cf_refresh_token');
    try {
      if (activeRefreshToken) {
        await axios.post(
          `${API_BASE}/auth/logout`,
          { refreshToken: activeRefreshToken },
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
        );
      }
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
