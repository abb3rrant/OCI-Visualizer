import React, { useState } from 'react';
import FileUploader from './FileUploader';
import ImportProgress from './ImportProgress';

interface ImportWizardProps {
  snapshotId: string;
  token: string | null;
}

interface UploadResult {
  resourceCount: number;
  resourceTypes: string[];
  errors: string[];
}

export default function ImportWizard({ snapshotId, token }: ImportWizardProps) {
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: File[]) => {
    setUploading(true);
    setError(null);

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/upload/${snapshotId}`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || response.statusText);
        }

        const result = await response.json();
        setResults(prev => [...prev, result]);
      } catch (err: any) {
        setError(err.message);
      }
    }

    setUploading(false);
  };

  const totalImported = results.reduce((sum, r) => sum + r.resourceCount, 0);
  const allTypes = [...new Set(results.flatMap(r => r.resourceTypes))];

  return (
    <div className="space-y-4">
      <FileUploader onFiles={handleFiles} disabled={uploading} />

      {uploading && <ImportProgress />}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {results.length > 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm font-medium text-green-800">
            Imported {totalImported} resources across {allTypes.length} types
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {allTypes.map(t => (
              <span key={t} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
