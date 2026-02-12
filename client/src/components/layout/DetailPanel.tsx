import React, { useState } from 'react';
import type { Resource } from '../../types';
import { formatOcid, formatDate, formatResourceType } from '../../utils/formatters';
import { getStateColor } from '../../utils/colors';
import StateBadge from '../common/StateBadge';

interface DetailPanelProps {
  resource: Resource;
  onClose: () => void;
}

export default function DetailPanel({ resource, onClose }: DetailPanelProps) {
  const [showRawJson, setShowRawJson] = useState(false);

  return (
    <div className="w-96 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div>
          <h2 className="font-semibold text-gray-900">{resource.displayName || 'Unnamed'}</h2>
          <p className="text-xs text-gray-500">{formatResourceType(resource.resourceType)}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Properties */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Properties</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">OCID</dt>
              <dd className="font-mono text-xs break-all">{resource.ocid}</dd>
            </div>
            <div>
              <dt className="text-gray-500">State</dt>
              <dd><StateBadge state={resource.lifecycleState} /></dd>
            </div>
            {resource.availabilityDomain && (
              <div>
                <dt className="text-gray-500">Availability Domain</dt>
                <dd>{resource.availabilityDomain}</dd>
              </div>
            )}
            {resource.regionKey && (
              <div>
                <dt className="text-gray-500">Region</dt>
                <dd>{resource.regionKey}</dd>
              </div>
            )}
            {resource.compartmentId && (
              <div>
                <dt className="text-gray-500">Compartment ID</dt>
                <dd className="font-mono text-xs break-all">{formatOcid(resource.compartmentId)}</dd>
              </div>
            )}
            {resource.timeCreated && (
              <div>
                <dt className="text-gray-500">Created</dt>
                <dd>{formatDate(resource.timeCreated)}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Freeform Tags */}
        {resource.freeformTags && Object.keys(resource.freeformTags).length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tags</h3>
            <div className="space-y-1">
              {Object.entries(resource.freeformTags).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-sm">
                  <span className="font-medium text-gray-700">{k}:</span>
                  <span className="text-gray-600">{v}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Relations */}
        {(resource.relationsFrom?.length || resource.relationsTo?.length) ? (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Relationships</h3>
            <div className="space-y-1 text-sm">
              {resource.relationsFrom?.map(r => (
                <div key={r.id} className="text-gray-600">
                  {r.relationType} → <span className="font-mono text-xs">{r.toResourceId.slice(0, 8)}...</span>
                </div>
              ))}
              {resource.relationsTo?.map(r => (
                <div key={r.id} className="text-gray-600">
                  {r.relationType} ← <span className="font-mono text-xs">{r.fromResourceId.slice(0, 8)}...</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Raw JSON toggle */}
        <section>
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            {showRawJson ? 'Hide' : 'Show'} Raw JSON
          </button>
          {showRawJson && (
            <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs overflow-auto max-h-96 border">
              {JSON.stringify(resource.rawData, null, 2)}
            </pre>
          )}
        </section>
      </div>
    </div>
  );
}
