import React, { useState, useEffect } from 'react';
import {
  User, KeyRound, Camera, Trash2, Save, CheckCircle2,
  AlertTriangle, ShieldCheck,
  Eye, EyeOff, RefreshCw, Settings, Check, Key, ShieldAlert, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PageSkeleton from '../../components/common/PageSkeleton';
import { safeImageUrl } from '../../utils/security';

const PRESET_AVATARS = [
  { label: 'Avatar 1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' },
  { label: 'Avatar 2', url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150' },
  { label: 'Avatar 3', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150' },
  { label: 'Avatar 4', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
  { label: 'Avatar 5', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
  { label: 'Avatar 6', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150' }
];

const AccountSettingsPortal = ({ onOpen2FAModal, onBack }) => {
  const { user, updateProfile, uploadAvatar, changePassword, deleteAccount, loading: authLoading } = useAuth();

  // Profile Form States
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [studentCode, setStudentCode] = useState(user?.studentCode || '');
  const [email, setEmail] = useState(user?.email || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState(null);

  // Password Form States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState(null);

  // Delete Account States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassInput, setDeletePassInput] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Update local state when user updates
  useEffect(() => {
    if (user) {
      setFullName(user.fullName || '');
      setStudentCode(user.studentCode || '');
      setEmail(user.email || '');
      setDepartment(user.department || '');
      setBio(user.bio || '');
      setAvatar(user.avatar || '');
    }
  }, [user]);

  // Handle Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileFeedback(null);

    const res = await updateProfile({
      fullName,
      studentCode,
      email,
      department,
      bio,
      avatar
    });

    setSavingProfile(false);
    if (res.success) {
      setProfileFeedback({ type: 'success', message: res.message });
      setTimeout(() => setProfileFeedback(null), 4000);
    } else {
      setProfileFeedback({ type: 'error', message: res.message });
    }
  };

  // Handle Local Avatar Upload with Sharp WebP
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfileFeedback({ type: 'error', message: 'Kích thước ảnh đại diện không được vượt quá 5MB!' });
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploadingAvatar(true);
    setProfileFeedback(null);

    const res = await uploadAvatar(formData);
    setUploadingAvatar(false);

    if (res.success) {
      if (res.avatar) setAvatar(res.avatar);
      setProfileFeedback({ type: 'success', message: '✨ Ảnh đại diện đã được tải lên và tối ưu hóa WebP thành công!' });
      setTimeout(() => setProfileFeedback(null), 4000);
    } else {
      setProfileFeedback({ type: 'error', message: res.message });
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (!oldPassword) {
      setPasswordFeedback({ type: 'error', message: 'Vui lòng nhập mật khẩu hiện tại.' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'Mật khẩu xác nhận không khớp với mật khẩu mới.' });
      return;
    }

    setSavingPassword(true);
    const res = await changePassword(oldPassword, newPassword, confirmPassword);
    setSavingPassword(false);

    if (res.success) {
      setPasswordFeedback({ type: 'success', message: '🎉 Đổi mật khẩu thành công! Hãy lưu giữ mật khẩu mới an toàn.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordFeedback(null), 5000);
    } else {
      setPasswordFeedback({ type: 'error', message: res.message });
    }
  };

  // Handle Delete Account
  const handleConfirmDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError('');

    if (!deletePassInput) {
      setDeleteError('Vui lòng nhập mật khẩu hiện tại để xác thực yêu cầu xóa tài khoản.');
      return;
    }

    setDeletingAccount(true);
    const res = await deleteAccount(deletePassInput);
    setDeletingAccount(false);

    if (!res.success) {
      setDeleteError(res.message);
    }
  };

  if (authLoading || !user) {
    return <PageSkeleton variant="settings" label="Đang tải cài đặt tài khoản" />;
  }

  return (
    <div className="settings-page" style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', paddingBottom: '60px' }}>
      
      {/* Top Banner Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px 28px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
            padding: '14px',
            borderRadius: '14px',
            display: 'flex',
            boxShadow: '0 0 20px rgba(14, 165, 233, 0.4)'
          }}>
            <Settings size={28} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, margin: '0 0 4px 0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Cài Đặt Tài Khoản & Hồ Sơ Cá Nhân
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                background: user?.role === 'ADMIN' ? 'rgba(244, 63, 94, 0.2)' : (user?.role === 'REVIEWER' ? 'rgba(251, 191, 36, 0.2)' : 'rgba(56, 189, 248, 0.2)'),
                color: user?.role === 'ADMIN' ? '#f43f5e' : (user?.role === 'REVIEWER' ? '#fbbf24' : '#38bdf8'),
                border: `1px solid ${user?.role === 'ADMIN' ? 'rgba(244, 63, 94, 0.4)' : (user?.role === 'REVIEWER' ? 'rgba(251, 191, 36, 0.4)' : 'rgba(56, 189, 248, 0.4)')}`
              }}>
                {user?.role}
              </span>
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-sub)', margin: 0 }}>
              Quản lý thông tin cá nhân, cập nhật ảnh đại diện, viết lời giới thiệu, đổi mật khẩu và bảo mật 2FA
            </p>
          </div>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px' }}
          >
            Quay Lại Bảng Điều Khiển
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px' }}>
        
        {/* ==========================================
            CỘT 1: HỒ SƠ, AVATAR & GIỚI THIỆU BẢN THÂN
           ========================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card: Hồ Sơ & Giới Thiệu Bản Thân */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <User size={20} color="#38bdf8" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Hồ Sơ & Giới Thiệu Bản Thân
              </h3>
            </div>

            {profileFeedback && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '18px',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: profileFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${profileFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: profileFeedback.type === 'success' ? '#34d399' : '#f87171'
              }}>
                {profileFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span>{profileFeedback.message}</span>
              </div>
            )}

            {/* Avatar Section */}
            <div style={{
              background: 'rgba(9, 13, 26, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '14px',
              padding: '18px',
              marginBottom: '20px'
            }}>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '12px' }}>
                📸 Ảnh Đại Diện (Avatar)
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {/* Avatar Preview */}
                <div style={{ position: 'relative', width: '84px', height: '84px', flexShrink: 0 }}>
                  <img
                    src={safeImageUrl(avatar, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')}
                    alt="Avatar Preview"
                    style={{
                      width: '84px',
                      height: '84px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #38bdf8',
                      boxShadow: '0 0 20px rgba(56, 189, 248, 0.35)'
                    }}
                  />
                  {uploadingAvatar && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      background: 'rgba(0, 0, 0, 0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <RefreshCw size={20} color="#38bdf8" className="animate-spin" />
                    </div>
                  )}
                </div>

                {/* Upload Button */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label
                    htmlFor="avatar-file-input"
                    className="btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      fontSize: '0.84rem',
                      cursor: 'pointer',
                      background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15), rgba(59, 130, 246, 0.15))',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8'
                    }}
                  >
                    <Camera size={16} />
                    <span>{uploadingAvatar ? 'Đang tải & tối ưu WebP...' : 'Tải Lên Ảnh Mới (JPG, PNG, WEBP)'}</span>
                  </label>
                  <input
                    id="avatar-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarFileChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </div>

              {/* Preset Avatars Selection */}
              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                  Hoặc chọn nhanh avatar mẫu có sẵn:
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {PRESET_AVATARS.map((item, idx) => (
                    <img
                      key={idx}
                      src={safeImageUrl(item.url)}
                      alt={item.label}
                      title={item.label}
                      onClick={() => setAvatar(item.url)}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        cursor: 'pointer',
                        border: avatar === item.url ? '2px solid #38bdf8' : '2px solid transparent',
                        transform: avatar === item.url ? 'scale(1.15)' : 'scale(1)',
                        transition: 'all 0.2s',
                        boxShadow: avatar === item.url ? '0 0 10px rgba(56, 189, 248, 0.5)' : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: user?.role === 'STUDENT' ? '1fr 1fr' : '1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                    Họ và Tên:
                  </label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Nguyễn Văn An"
                  />
                </div>

                {user?.role === 'STUDENT' && (
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                      Mã Số Sinh Viên (MSSV):
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={studentCode}
                      onChange={e => setStudentCode(e.target.value)}
                      placeholder="SV2026-9921"
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                    Địa Chỉ Email:
                  </label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="user@caseflow.ai"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                    Khoa / Ban Phụ Trách:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    placeholder="Khoa Công Nghệ Thông Tin"
                  />
                </div>
              </div>

              {/* Bio / Giới thiệu bản thân */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    📝 Giới Thiệu Bản Thân (Bio):
                  </label>
                  <span style={{ fontSize: '0.74rem', color: bio.length > 450 ? '#f43f5e' : 'var(--text-muted)' }}>
                    {bio.length}/500 ký tự
                  </span>
                </div>
                <textarea
                  rows={4}
                  maxLength={500}
                  className="form-input"
                  style={{ resize: 'vertical', lineHeight: 1.5, minHeight: '90px' }}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Hãy viết vài dòng giới thiệu về bản thân, ngành học, định hướng nghề nghiệp hoặc sở thích cá nhân..."
                />
                <p style={{ fontSize: '0.74rem', color: 'var(--text-sub)', margin: '4px 0 0 0' }}>
                  Thông tin này sẽ hiển thị trong hồ sơ minh chứng và nhật ký thẩm định xử lý đơn.
                </p>
              </div>

              {/* Custom Avatar URL Field */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Liên kết ảnh đại diện tùy chỉnh (Avatar URL):
                </label>
                <input
                  type="url"
                  className="form-input"
                  value={avatar}
                  onChange={e => setAvatar(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="btn-primary shimmer-button"
                style={{
                  marginTop: '8px',
                  height: '44px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)'
                }}
              >
                <Save size={16} />
                <span>{savingProfile ? 'Đang lưu hồ sơ...' : 'Lưu Thay Đổi Hồ Sơ'}</span>
              </button>
            </form>
          </div>

        </div>

        {/* ==========================================
            CỘT 2: ĐỔI MẬT KHẨU, 2FA & XÓA TÀI KHOẢN
           ========================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Card: Đổi Mật Khẩu */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <KeyRound size={20} color="#fbbf24" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Đổi Mật Khẩu
              </h3>
            </div>

            {passwordFeedback && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '18px',
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: passwordFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${passwordFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: passwordFeedback.type === 'success' ? '#34d399' : '#f87171'
              }}>
                {passwordFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span>{passwordFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Mật khẩu hiện tại */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Mật Khẩu Hiện Tại:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showOldPass ? 'text' : 'password'}
                    required
                    className="form-input"
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    {showOldPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Mật Khẩu Mới (Tối thiểu 6 ký tự):
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="form-input"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Xác Nhận Mật Khẩu Mới:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    className="form-input"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && newPassword && (
                  <div style={{ marginTop: '6px', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {newPassword === confirmPassword ? (
                      <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Check size={14} /> Mật khẩu xác nhận khớp hoàn toàn
                      </span>
                    ) : (
                      <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={14} /> Mật khẩu xác nhận chưa khớp
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={savingPassword || !oldPassword || !newPassword || newPassword !== confirmPassword}
                className="btn-primary shimmer-button"
                style={{
                  marginTop: '8px',
                  height: '44px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #d97706, #f59e0b)'
                }}
              >
                <Key size={16} />
                <span>{savingPassword ? 'Đang cập nhật mật khẩu...' : 'Cập Nhật Mật Khẩu Mới'}</span>
              </button>
            </form>
          </div>

          {/* Card: Xác Thực 2FA Shortcut */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color={user?.twoFactorEnabled ? '#34d399' : '#fbbf24'} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Xác Thực 2 Bước (2FA TOTP)
                </h3>
              </div>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                background: user?.twoFactorEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                color: user?.twoFactorEnabled ? '#34d399' : '#fbbf24',
                border: `1px solid ${user?.twoFactorEnabled ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
              }}>
                {user?.twoFactorEnabled ? 'ĐANG BẬT' : 'CHƯA BẬT'}
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Bảo vệ tài khoản an toàn với Google Authenticator / Microsoft Authenticator. Mỗi lần đăng nhập sẽ yêu cầu mã OTP 6 chữ số theo thời gian thực.
            </p>

            <button
              onClick={onOpen2FAModal}
              className="btn-secondary"
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: user?.twoFactorEnabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                border: `1px solid ${user?.twoFactorEnabled ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                color: user?.twoFactorEnabled ? '#34d399' : '#fbbf24'
              }}
            >
              <ShieldAlert size={16} />
              <span>{user?.twoFactorEnabled ? 'Cấu Hình Lại / Tắt 2FA' : 'Kích Hoạt Bảo Mật 2FA Ngay'}</span>
            </button>
          </div>

          {/* Card: Danger Zone (Xóa Tài Khoản) */}
          <div style={{
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(239, 68, 68, 0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertTriangle size={20} color="#f43f5e" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f43f5e' }}>
                Khu Vực Nguy Hiểm (Danger Zone)
              </h3>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-sub)', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              Khi xóa tài khoản, toàn bộ dữ liệu phiên làm việc, quyền truy cập và thông tin đăng nhập của bạn sẽ bị xóa vĩnh viễn khỏi cơ sở dữ liệu SQLite và không thể phục hồi.
            </p>

            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(true);
                setDeleteError('');
                setDeletePassInput('');
              }}
              className="btn-danger"
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.86rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                boxShadow: '0 4px 15px rgba(220, 38, 38, 0.35)'
              }}
            >
              <Trash2 size={16} />
              <span>Xóa Tài Khoản Vĩnh Viễn</span>
            </button>
          </div>

        </div>

      </div>

      {/* Modal Xác Nhận Xóa Tài Khoản */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 10px 40px rgba(239, 68, 68, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
                <Trash2 size={24} color="#f43f5e" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#f43f5e' }}>
                  Xác Nhận Xóa Tài Khoản
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-sub)', margin: 0 }}>
                  Hành động này không thể hoàn tác!
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: '20px' }}>
              Bạn đang yêu cầu xóa tài khoản <strong>{user?.username}</strong> ({user?.fullName}). Vui lòng nhập mật khẩu hiện tại của bạn để hoàn tất xác nhận:
            </p>

            {deleteError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.82rem',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{deleteError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDeleteAccount}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>
                  Mật Khẩu Xác Nhận:
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  className="form-input"
                  value={deletePassInput}
                  onChange={e => setDeletePassInput(e.target.value)}
                  placeholder="Nhập mật khẩu của bạn..."
                  style={{ borderColor: '#ef4444' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary"
                  style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '0.86rem' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={deletingAccount || !deletePassInput}
                  className="btn-danger"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {deletingAccount ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  <span>{deletingAccount ? 'Đang xóa...' : 'Xác Nhận Xóa'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};


export default AccountSettingsPortal;
