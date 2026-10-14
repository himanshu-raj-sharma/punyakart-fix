import React, { useState, useEffect } from 'react';
import { X, Phone, KeyRound, Loader2, ArrowRight } from 'lucide-react';
import { useDonorAuth } from './DonorAuthContext';
import { Language } from '../types';
import { translations } from '../data/content';

interface DonorLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const DonorLoginModal: React.FC<DonorLoginModalProps> = ({ isOpen, onClose, language }) => {
  const t = translations[language];
  const { login } = useDonorAuth();

  const [phone, setPhone] = useState('');
  const [secretId, setSecretId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPhone('');
      setSecretId('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!secretId.trim()) {
      setError('Please enter your Receipt No, Transaction ID, or PAN.');
      return;
    }
    setLoading(true);
    setError(null);
    const res = await login(cleanPhone, secretId.trim());
    setLoading(false);
    if (res.success) {
      onClose();
    } else {
      setError(res.error || 'Invalid credentials.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onClose}
            className="p-2 bg-black/5 hover:bg-black/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Donor Login</h2>
            <p className="text-gray-500">Access your donation history and certificates</p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-start gap-2">
              <span className="shrink-0 mt-0.5 font-bold">!</span>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="absolute inset-y-0 left-10 flex items-center pointer-events-none text-gray-500 font-medium">
                  +91
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit number"
                  className="block w-full pl-20 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Receipt No / Transaction ID / PAN
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={secretId}
                  onChange={(e) => setSecretId(e.target.value)}
                  placeholder="Enter your identifier"
                  className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || phone.length < 10 || !secretId.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
