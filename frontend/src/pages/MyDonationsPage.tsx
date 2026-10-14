import React, { useEffect, useState } from 'react';
import { useDonorAuth } from '../components/DonorAuthContext';
import { Language } from '../types';
import { translations } from '../data/content';
import { LogOut, FileText, Receipt, Loader2, Download, AlertCircle } from 'lucide-react';

interface MyDonationsPageProps {
  language: Language;
}

interface DonationRecord {
  id: string;
  amount: number;
  type: 'one-time' | 'monthly';
  causeTitle: string;
  timestamp: string;
  receiptNumber: string;
  transactionId: string;
  paymentMethod: string;
  status: string;
  want80G: boolean;
  source?: string;
}

export const MyDonationsPage: React.FC<MyDonationsPageProps> = ({ language }) => {
  const t = translations[language];
  const { donor, token, logout } = useDonorAuth();
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null); // tracks ID being downloaded

  useEffect(() => {
    if (!token) return;

    const fetchDonations = async () => {
      try {
        const res = await fetch('/api/donor/donations', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch donations');
        setDonations(data.donations);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load donations');
      } finally {
        setLoading(false);
      }
    };

    fetchDonations();
  }, [token]);

  const handleDownload = async (donation: DonationRecord, type: 'receipt' | 'certificate') => {
    if (downloading) return;
    setDownloading(`${donation.id}-${type}`);
    try {
      const endpoint = type === 'certificate' ? '/api/donations/certificate.pdf' : '/api/donations/receipt.pdf';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ donationId: donation.id, receiptNumber: donation.receiptNumber }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || 'Failed to generate document');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type === 'certificate' ? '80G-Certificate' : 'Receipt'}-${donation.receiptNumber || donation.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading document. Please try again later.');
    } finally {
      setDownloading(null);
    }
  };

  if (!donor) {
    return (
      <div className="public-page min-h-[60vh] flex flex-col items-center justify-center p-4">
        <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Login Required</h2>
        <p className="text-gray-600 mb-6 text-center max-w-md">
          Please login to view your donation history and download your 80G certificates.
        </p>
      </div>
    );
  }

  return (
    <div className="public-page w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Donations</h1>
          <p className="text-gray-600 mt-1">
            Welcome back, {donor.name || 'Donor'} ({donor.phone})
          </p>
        </div>
        <button
          onClick={logout}
          className="min-h-11 flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      ) : donations.length === 0 ? (
        <div className="public-muted-surface rounded-2xl p-8 sm:p-12 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No donations yet</h3>
          <p className="text-gray-600 mb-6 max-w-sm mx-auto">
            When you make a donation, it will appear here along with your 80G tax exemption certificates.
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          >
            Make a Donation
          </a>
        </div>
      ) : (
        <div className="grid gap-6">
          {donations.map((d) => (
            <div key={d.id} className="public-card rounded-2xl border p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="space-y-3 flex-grow min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-gray-900">₹{d.amount.toLocaleString('en-IN')}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      d.type === 'monthly' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {d.type === 'monthly' ? 'Monthly' : 'One-time'}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-900 break-words">{d.causeTitle}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(d.timestamp).toLocaleDateString('en-IN', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-sm text-gray-600">
                    <div className="min-w-0 break-words">
                      <span className="block text-gray-400 text-xs uppercase tracking-wider mb-0.5">Receipt</span>
                      <span className="font-mono">{d.receiptNumber || '-'}</span>
                    </div>
                    <div className="min-w-0 break-words">
                      <span className="block text-gray-400 text-xs uppercase tracking-wider mb-0.5">Payment Ref</span>
                      <span className="font-mono">{d.transactionId || '-'}</span>
                    </div>
                    <div className="min-w-0 break-words">
                      <span className="block text-gray-400 text-xs uppercase tracking-wider mb-0.5">Method</span>
                      <span className="capitalize">{d.paymentMethod.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:min-w-[200px] justify-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                  <button
                    onClick={() => handleDownload(d, 'receipt')}
                    disabled={!!downloading}
                    className="min-h-11 flex items-center justify-center gap-2 px-4 py-2.5 public-muted-surface hover:bg-[var(--public-surface)] text-gray-700 rounded-xl transition-colors font-medium text-sm border border-[var(--public-border)]"
                  >
                    {downloading === `${d.id}-receipt` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download Receipt
                  </button>
                  
                  {d.want80G && d.receiptNumber && (
                    <button
                      onClick={() => handleDownload(d, 'certificate')}
                      disabled={!!downloading}
                      className="min-h-11 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors font-medium text-sm border border-blue-200"
                    >
                      {downloading === `${d.id}-certificate` ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      80G Certificate
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
