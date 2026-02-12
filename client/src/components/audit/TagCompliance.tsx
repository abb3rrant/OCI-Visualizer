import React, { useState } from 'react';
import type { TagReport } from '../../types';

interface TagComplianceProps {
  report: TagReport | null;
  requiredTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function TagCompliance({ report, requiredTags, onTagsChange }: TagComplianceProps) {
  const [newTag, setNewTag] = useState('');

  const addTag = () => {
    if (newTag.trim() && !requiredTags.includes(newTag.trim())) {
      onTagsChange([...requiredTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    onTagsChange(requiredTags.filter(t => t !== tag));
  };

  return (
    <div className="space-y-4">
      {/* Tag input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTag()}
          placeholder="Add required tag key..."
          className="input-field flex-1"
        />
        <button onClick={addTag} className="btn-primary text-sm">Add</button>
      </div>

      <div className="flex flex-wrap gap-2">
        {requiredTags.map(tag => (
          <span key={tag} className="badge bg-blue-100 text-blue-700 gap-1">
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-blue-900">&times;</button>
          </span>
        ))}
      </div>

      {report && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <div className="text-2xl font-bold text-gray-900">{report.totalResources}</div>
              <div className="text-xs text-gray-500">Total Resources</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-green-600">{report.compliantResources}</div>
              <div className="text-xs text-gray-500">Compliant</div>
            </div>
            <div className="card text-center">
              <div className="text-2xl font-bold text-red-600">{report.nonCompliantResources}</div>
              <div className="text-xs text-gray-500">Non-Compliant</div>
            </div>
          </div>

          {/* Coverage bars */}
          <div className="space-y-3">
            {report.tagCoverage.map(tc => (
              <div key={tc.tagKey}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{tc.tagKey}</span>
                  <span className="text-gray-500">{tc.count}/{tc.total} ({tc.percentage.toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full"
                    style={{
                      width: `${tc.percentage}%`,
                      backgroundColor: tc.percentage >= 80 ? '#10B981' : tc.percentage >= 50 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
