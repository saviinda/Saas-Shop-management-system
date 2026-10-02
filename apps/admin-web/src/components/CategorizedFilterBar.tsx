'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Filter,
  Plus,
  X,
  Search,
  Calendar,
  CreditCard,
  Package,
  User,
  Tag,
  Check,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';

export type FilterType = 'select' | 'date-range' | 'date' | 'text';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterCategory {
  id: string;
  label: string;
  icon?: any;
  type: FilterType;
  options?: FilterOption[];
  placeholder?: string;
}

export interface ActiveFilter {
  categoryId: string;
  value: any;
  label: string;
  displayValue: string;
}

export interface CategorizedFilterBarProps {
  search?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  categories: FilterCategory[];
  activeFilters: Record<string, any>;
  onFilterChange: (categoryId: string, value: any) => void;
  onClearFilters: () => void;
  className?: string;
}

export const CategorizedFilterBar: React.FC<CategorizedFilterBarProps> = ({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search records...',
  categories,
  activeFilters,
  onFilterChange,
  onClearFilters,
  className = '',
}) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [activePickerCategory, setActivePickerCategory] = useState<FilterCategory | null>(null);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  const menuRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsAddMenuOpen(false);
      }
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setActivePickerCategory(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getCategoryIcon = (category: FilterCategory) => {
    if (category.icon) {
      const IconComponent = category.icon;
      return <IconComponent className="h-4 w-4" />;
    }
    const id = category.id.toLowerCase();
    if (id.includes('date')) return <Calendar className="h-4 w-4 text-amber-500" />;
    if (id.includes('payment') || id.includes('price')) return <CreditCard className="h-4 w-4 text-emerald-500" />;
    if (id.includes('order') || id.includes('job')) return <Package className="h-4 w-4 text-indigo-500" />;
    if (id.includes('customer') || id.includes('user') || id.includes('owner')) return <User className="h-4 w-4 text-blue-500" />;
    if (id.includes('product') || id.includes('category')) return <Tag className="h-4 w-4 text-purple-500" />;
    return <Filter className="h-4 w-4 text-slate-400" />;
  };

  const handleSelectOption = (categoryId: string, optionValue: string) => {
    onFilterChange(categoryId, optionValue);
    setActivePickerCategory(null);
    setIsAddMenuOpen(false);
  };

  const handleDatePreset = (preset: string) => {
    const now = new Date();
    let from = '';
    let to = '';

    if (preset === 'today') {
      from = now.toISOString().split('T')[0];
      to = from;
    } else if (preset === 'yesterday') {
      const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      from = y.toISOString().split('T')[0];
      to = from;
    } else if (preset === '7days') {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      from = d.toISOString().split('T')[0];
      to = now.toISOString().split('T')[0];
    } else if (preset === '30days') {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      from = d.toISOString().split('T')[0];
      to = now.toISOString().split('T')[0];
    } else if (preset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      from = start.toISOString().split('T')[0];
      to = now.toISOString().split('T')[0];
    }

    onFilterChange('dateRange', { from, to, preset });
    setActivePickerCategory(null);
    setIsAddMenuOpen(false);
  };

  const handleApplyCustomDateRange = () => {
    if (!customDateFrom && !customDateTo) return;
    onFilterChange('dateRange', {
      from: customDateFrom,
      to: customDateTo || customDateFrom,
      preset: 'custom',
    });
    setActivePickerCategory(null);
    setIsAddMenuOpen(false);
  };

  // Build active filter pills
  const activePills: Array<{
    categoryId: string;
    categoryLabel: string;
    displayValue: string;
  }> = [];

  Object.entries(activeFilters).forEach(([catId, val]) => {
    if (!val || val === 'all' || val === '') return;

    if (catId === 'dateRange' && typeof val === 'object') {
      let label = 'Date';
      let display = `${val.from} to ${val.to}`;
      if (val.preset === 'today') display = 'Today';
      else if (val.preset === 'yesterday') display = 'Yesterday';
      else if (val.preset === '7days') display = 'Last 7 Days';
      else if (val.preset === '30days') display = 'Last 30 Days';
      else if (val.preset === 'this_month') display = 'This Month';
      activePills.push({ categoryId: catId, categoryLabel: label, displayValue: display });
      return;
    }

    const cat = categories.find(c => c.id === catId);
    if (!cat) return;

    let displayValue = String(val);
    if (cat.options) {
      const matched = cat.options.find(o => o.value === val);
      if (matched) displayValue = matched.label;
    }

    activePills.push({
      categoryId: catId,
      categoryLabel: cat.label.replace(' Filters', '').replace(' Filter', ''),
      displayValue,
    });
  });

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Top Bar: Search + Add Filter + Reset */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        {onSearchChange && (
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-9 py-2 text-xs font-medium bg-white border border-slate-200/90 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 shadow-2xs transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-md transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Add Filter Category Button & Dropdown */}
        <div className="flex items-center gap-2 relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => {
              setIsAddMenuOpen(!isAddMenuOpen);
              setActivePickerCategory(null);
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl shadow-2xs hover:border-slate-300 transition-all cursor-pointer"
          >
            <Filter className="h-3.5 w-3.5 text-indigo-600" />
            <span>Add Filter</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {/* Category Dropdown Menu */}
          {isAddMenuOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-64 bg-white rounded-2xl border border-slate-200/90 shadow-xl z-40 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                Filter Categories
              </div>

              <div className="max-h-72 overflow-y-auto space-y-0.5 pt-1">
                {categories.map((cat) => {
                  const isActive = Boolean(activeFilters[cat.id] && activeFilters[cat.id] !== 'all');
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setActivePickerCategory(cat);
                        setIsAddMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-700 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="p-1 rounded-lg bg-slate-100 text-slate-600">
                          {getCategoryIcon(cat)}
                        </span>
                        <span>{cat.label}</span>
                      </div>
                      {isActive && (
                        <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reset Filters Button */}
          {activePills.length > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors"
              title="Clear all active filters"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Specific Picker Modal / Popover */}
      {activePickerCategory && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-2xs flex items-center justify-center p-4">
          <div
            ref={pickerRef}
            className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                  {getCategoryIcon(activePickerCategory)}
                </span>
                <h3 className="font-bold text-slate-900 text-sm">
                  {activePickerCategory.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePickerCategory(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* DATE RANGE PICKER */}
            {activePickerCategory.type === 'date-range' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 font-medium">
                  Select a pre-configured timeframe or specify custom start & end dates:
                </p>

                {/* Presets */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Today', key: 'today' },
                    { label: 'Yesterday', key: 'yesterday' },
                    { label: 'Last 7 Days', key: '7days' },
                    { label: 'Last 30 Days', key: '30days' },
                    { label: 'This Month', key: 'this_month' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleDatePreset(p.key)}
                      className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors text-left"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Range Picker */}
                <div className="pt-2 border-t border-slate-100 space-y-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Custom Date Range
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customDateFrom}
                        onChange={(e) => setCustomDateFrom(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customDateTo}
                        onChange={(e) => setCustomDateTo(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomDateRange}
                    disabled={!customDateFrom}
                    className="w-full mt-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors shadow-2xs"
                  >
                    Apply Custom Range
                  </button>
                </div>
              </div>
            )}

            {/* SELECT OPTIONS PICKER */}
            {activePickerCategory.type === 'select' && activePickerCategory.options && (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {activePickerCategory.options.map((opt) => {
                  const isSelected = activeFilters[activePickerCategory.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelectOption(activePickerCategory.id, opt.value)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-colors text-left ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="h-4 w-4 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active Filter Pills Bar */}
      {activePills.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-1 animate-in fade-in duration-200">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Active:
          </span>
          {activePills.map((pill) => (
            <span
              key={pill.categoryId}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50/80 text-indigo-700 border border-indigo-200/80 rounded-full text-xs font-semibold shadow-2xs"
            >
              <span className="text-slate-500 font-normal">{pill.categoryLabel}:</span>
              <span>{pill.displayValue}</span>
              <button
                type="button"
                onClick={() => onFilterChange(pill.categoryId, pill.categoryId === 'dateRange' ? null : 'all')}
                className="hover:bg-indigo-200/60 rounded-full p-0.5 text-indigo-500 hover:text-indigo-800 transition-colors"
                title={`Remove ${pill.categoryLabel} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 underline underline-offset-2 ml-1 cursor-pointer transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
