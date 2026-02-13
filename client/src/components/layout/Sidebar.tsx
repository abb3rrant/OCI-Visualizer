import React, { useState, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from 'urql';
import { useSnapshot } from '../../contexts/SnapshotContext';
import { COMPARTMENTS_QUERY } from '../../graphql/queries';

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { to: '/topology', label: 'Topology', icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z' },
  { to: '/inventory', label: 'Inventory', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { to: '/explorer', label: 'Explorer', icon: 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z' },
  { to: '/audit', label: 'Audit', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { to: '/import', label: 'Import', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
];

interface CompartmentNode {
  ocid: string;
  displayName: string | null;
  compartmentId: string | null;
  children: CompartmentNode[];
}

function buildTree(compartments: any[]): CompartmentNode[] {
  const map = new Map<string, CompartmentNode>();

  for (const c of compartments) {
    map.set(c.ocid, { ocid: c.ocid, displayName: c.displayName, compartmentId: c.compartmentId, children: [] });
  }

  const roots: CompartmentNode[] = [];
  for (const node of map.values()) {
    if (node.compartmentId && map.has(node.compartmentId)) {
      map.get(node.compartmentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function CompartmentTreeItem({ node, depth }: { node: CompartmentNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const navigate = useNavigate();
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-gray-100 cursor-pointer group"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="w-4 h-4 flex items-center justify-center text-gray-400 shrink-0">
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span
          className="truncate text-gray-700 group-hover:text-blue-600"
          onClick={() => navigate(`/inventory?compartment=${node.ocid}`)}
          title={node.displayName || node.ocid}
        >
          {node.displayName || node.ocid.slice(-8)}
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children
            .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
            .map((child) => (
              <CompartmentTreeItem key={child.ocid} node={child} depth={depth + 1} />
            ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { currentSnapshot } = useSnapshot();

  const [compartmentsResult] = useQuery({
    query: COMPARTMENTS_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot,
  });
  const compartments = compartmentsResult.data?.compartments || [];
  const tree = useMemo(() => buildTree(compartments), [compartments]);

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-y-auto">
      <nav className="p-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
            </svg>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Compartment tree */}
      {tree.length > 0 && (
        <div className="border-t border-gray-200 px-3 py-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Compartments</h3>
          <div className="space-y-0.5">
            {tree
              .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
              .map((node) => (
                <CompartmentTreeItem key={node.ocid} node={node} depth={0} />
              ))}
          </div>
        </div>
      )}
    </aside>
  );
}
