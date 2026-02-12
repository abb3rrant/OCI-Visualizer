import React from 'react';

interface FilterPanelProps {
  resourceTypes: string[];
  selectedType: string;
  onTypeChange: (type: string) => void;
  selectedState: string;
  onStateChange: (state: string) => void;
}

const STATES = ['', 'RUNNING', 'ACTIVE', 'AVAILABLE', 'STOPPED', 'TERMINATED', 'FAILED', 'PROVISIONING'];

export default function FilterPanel({ resourceTypes, selectedType, onTypeChange, selectedState, onStateChange }: FilterPanelProps) {
  return (
    <div className="flex gap-3 items-center">
      <select
        value={selectedType}
        onChange={(e) => onTypeChange(e.target.value)}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
      >
        <option value="">All types</option>
        {resourceTypes.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <select
        value={selectedState}
        onChange={(e) => onStateChange(e.target.value)}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
      >
        <option value="">All states</option>
        {STATES.filter(Boolean).map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}
