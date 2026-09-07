'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Shop } from '@saas/types';
import { useModal } from '@/lib/modal-context';
import {
  Store,
  UploadCloud,
  Globe,
  Clock,
  FileText,
  Shield,
  Save,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  Camera,
  X,
  Mail,
  Phone,
  MapPin,
  Tag,
  User,
} from 'lucide-react';

export default function ShopInformationPage() {
  const { user, shop, refreshUser } = useAuth();
  const { showSuccess, showError } = useModal();
  const [shopData, setShopData] = useState<Shop | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State for Permitted Fields
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [facebook, setFacebook] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [website, setWebsite] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadShopData = async () => {
    if (!shop?.id) return;
    try {
      setIsLoading(true);
      const res = await api.get<any>(`/shops/${shop.id}`);
      const s = res.data?.shop || res.data;
      setShopData(s);
      setDescription(s.description || '');
      setLogoUrl(s.logoUrl || '');
      setOpeningHours(s.openingHours || '');
      setSecondaryPhone(s.secondaryPhone || '');
      if (s.socialMedia) {
        setFacebook(s.socialMedia.facebook || '');
        setInstagram(s.socialMedia.instagram || '');
        setTwitter(s.socialMedia.twitter || '');
        setWebsite(s.socialMedia.website || '');
      }
    } catch (err) {
      console.error('Failed to load shop information:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadShopData();
  }, [shop?.id]);

  const handleLogoUpload = (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('Invalid File', 'Please select an image file (PNG, JPG, JPEG, WEBP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      setLogoUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePermittedInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopData?.id) return;

    setIsSaving(true);
    try {
      await api.patch(`/shops/${shopData.id}/profile`, {
        description: description.trim(),
        logoUrl: logoUrl.trim(),
        openingHours: openingHours.trim(),
        socialMedia: {
          facebook: facebook.trim(),
          instagram: instagram.trim(),
          twitter: twitter.trim(),
          website: website.trim(),
        },
      });

      await refreshUser();
      await loadShopData();

      showSuccess(
        'Store Profile Updated',
        'Your permitted operational information (description, logo, opening hours, social links) has been saved.'
      );
    } catch (err: any) {
      showError('Save Failed', err.message || 'Failed to update shop profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Shop Information & Operational Settings</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              Profile Management
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Update permitted operational store profiles, logo branding, social media, and view protected legal information
          </p>
        </div>

        <Link
          href="/shop-owner/change-requests"
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors shadow-2xs self-start sm:self-auto"
        >
          <Shield className="h-4 w-4" /> Request Change for Protected Data &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Store Profile Branding & Logo Upload */}
        <div className="space-y-6">
          {/* Logo Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 space-y-4 text-center">
            <h3 className="font-bold text-slate-900 text-sm">Store Brand Logo</h3>
            <div className="relative mx-auto h-32 w-32 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center group shadow-inner">
              {logoUrl ? (
                <img src={logoUrl} alt="Store Logo" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-2">
                  <Store className="h-8 w-8 mb-1" />
                  <span className="text-[10px] font-semibold">No Logo</span>
                </div>
              )}

              {/* Upload Overlay */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
              >
                <Camera className="h-6 w-6 mb-1" />
                <span className="text-[10px] font-bold">Change Logo</span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
              className="hidden"
            />

            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition-colors"
              >
                Upload New Image
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">Recommended: Square PNG or JPG at least 300x300px</p>
          </div>

          {/* Protected Fields Summary Box */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
              <Lock className="h-4 w-4 text-amber-600" /> Protected Legal Information
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Official legal business name, category, registered address, and primary email are protected to safeguard store governance.
            </p>
            <div className="space-y-2 text-xs pt-1">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Business Name</span>
                <span className="font-bold text-slate-900">{shopData?.name || shop?.name}</span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Category</span>
                <span className="font-bold text-indigo-700">{shopData?.category || shop?.category}</span>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Primary Email</span>
                <span className="font-mono text-[11px] text-slate-800">{shopData?.email || shop?.email}</span>
              </div>
            </div>

            <Link
              href="/shop-owner/change-requests"
              className="block text-center py-2 bg-white hover:bg-slate-100 text-indigo-600 font-semibold text-xs rounded-xl border border-indigo-200 shadow-2xs transition-colors"
            >
              Submit Change Request &rarr;
            </Link>
          </div>
        </div>

        {/* Right 2 Columns: Editable Permitted Information Form */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSavePermittedInfo} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm shadow-slate-200/50 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900">Permitted Store Profile & Operations</h2>
              <p className="text-xs text-slate-500">Configure customer-facing descriptions, operating schedule, and social media handles</p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Description */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">Shop Description & About Store</label>
                <textarea
                  rows={3}
                  placeholder="Tell customers and staff about your store, products, and services..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              {/* Operating / Opening Hours */}
              <div>
                <label className="block font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-indigo-600" /> Opening & Operating Hours
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mon - Fri: 8:00 AM - 9:00 PM | Sat - Sun: 9:00 AM - 10:00 PM"
                  value={openingHours}
                  onChange={e => setOpeningHours(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500 shadow-2xs font-medium"
                />
              </div>

              {/* Social Media Links Header */}
              <div className="pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5 mb-3">
                  <Globe className="h-4 w-4 text-indigo-600" /> Online Presence & Social Media Profiles
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Official Website</label>
                    <input
                      type="url"
                      placeholder="https://www.yourshop.com"
                      value={website}
                      onChange={e => setWebsite(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Facebook Page</label>
                    <input
                      type="text"
                      placeholder="facebook.com/yourshop"
                      value={facebook}
                      onChange={e => setFacebook(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Instagram Handle</label>
                    <input
                      type="text"
                      placeholder="@yourshop"
                      value={instagram}
                      onChange={e => setInstagram(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Twitter / X Handle</label>
                    <input
                      type="text"
                      placeholder="@yourshop_x"
                      value={twitter}
                      onChange={e => setTwitter(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
