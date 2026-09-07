'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api, ApiError } from '@/lib/api-client';
import { SubscriptionPackage } from '@saas/types';
import { Store, User, Mail, Lock, Phone, MapPin, Tag, ArrowRight, Check } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    businessName: '',
    businessAddress: '',
    businessCategory: 'Retail & Specialty Store',
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get<SubscriptionPackage[]>('/packages').then(res => {
      setPackages(res.data);
      if (res.data.length > 0) {
        setSelectedPackageId(res.data[0].id);
      }
    }).catch(err => console.error('Failed to load packages:', err));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await api.post<any>('/auth/register', {
        ...formData,
        packageId: selectedPackageId,
      });

      login(res.data.token, res.data.user, res.data.shop, res.data.defaultBranch);
      router.push('/shop-owner/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to complete shop registration');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80 py-12 px-4 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-white p-8 sm:p-10 rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/50 space-y-7 transition-all duration-300">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-bold shadow-md shadow-indigo-200">
            <Store className="h-6 w-6" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-[11px] font-semibold uppercase tracking-wider">
            Instant Onboarding
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Register Business Account</h2>
          <p className="text-xs text-slate-500 font-medium">
            Automated Default Branch creation & SaaS tenant activation (BR-13)
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50/80 border border-rose-200 p-3.5 text-xs text-rose-700 flex items-center gap-2.5 animate-in fade-in duration-200">
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Plan Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
              1. Choose Subscription Package
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {packages.map(pkg => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackageId(pkg.id)}
                  className={`cursor-pointer rounded-2xl p-4 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    selectedPackageId === pkg.id
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-sm shadow-indigo-100 ring-2 ring-indigo-600/10'
                      : 'border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 text-xs">{pkg.name}</p>
                    {selectedPackageId === pkg.id && (
                      <div className="h-4 w-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <p className="text-xl font-extrabold text-indigo-700 mt-2">${pkg.price}<span className="text-[11px] text-slate-500 font-normal">/mo</span></p>
                  <div className="mt-2.5 text-[11px] text-slate-600 space-y-1 pt-2 border-t border-slate-200/60 font-medium">
                    <p>• {pkg.limits.branches} Branch{pkg.limits.branches > 1 ? 'es' : ''}</p>
                    <p>• {pkg.limits.users} Staff Users</p>
                    <p>• {pkg.limits.products} Products</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Owner Account Details */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
              2. Shop Owner Credentials
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Marcus Vance"
                    className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="owner@business.com"
                    className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Contact Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 555 234 5678"
                    className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Business & Default Branch */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
              3. Business Information & Default Branch (BR-13)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Business Name</label>
                <div className="relative">
                  <Store className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.businessName}
                    onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                    placeholder="Urban Cafe Hub"
                    className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Business Category</label>
                <div className="relative">
                  <Tag className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.businessCategory}
                    onChange={e => setFormData({ ...formData, businessCategory: e.target.value })}
                    placeholder="Specialty Coffee & Bakery"
                    className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Physical Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formData.businessAddress}
                    onChange={e => setFormData({ ...formData, businessAddress: e.target.value })}
                    placeholder="104 Main Street, Downtown Financial District"
                    className="w-full rounded-xl bg-slate-50/70 border border-slate-200/90 py-2.5 pl-10 pr-3 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all duration-200 shadow-sm shadow-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-sm shadow-indigo-200 hover:shadow-md hover:shadow-indigo-300/50 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
          >
            {isSubmitting ? 'Creating Shop & Provisioning...' : 'Complete Registration & Access Dashboard'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Already have an account?{' '}
            <Link href="/login" className="font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-2 transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
