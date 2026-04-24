import React, { useState, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from 'urql';
import { useSnapshot } from '../../contexts/SnapshotContext';
import { useAuth } from '../../contexts/AuthContext';
import { COMPARTMENTS_QUERY } from '../../graphql/queries';

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1' },
  { to: '/topology', label: 'Topology', icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z' },
  { to: '/inventory', label: 'Inventory', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { to: '/compute', label: 'Compute', icon: 'M5 12h14M12 5v14M4 8V6a2 2 0 012-2h12a2 2 0 012 2v2M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2' },
  { to: '/network', label: 'Network', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { to: '/explorer', label: 'Explorer', icon: 'M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z' },
  { to: '/audit', label: 'Audit', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { to: '/identity', label: 'Identity', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
  { to: '/diff', label: 'Diff', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { to: '/import', label: 'Import', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12' },
  { to: '/tags', label: 'Tag Editor', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z' },
  { to: '/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { to: '/admin', label: 'Admin', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
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
        className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer group"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-4 h-4 flex items-center justify-center text-gray-400 dark:text-gray-500 shrink-0"
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.displayName || node.ocid}`}
          >
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <button
          className="truncate text-gray-700 dark:text-gray-200 group-hover:text-blue-600 bg-transparent border-none p-0 text-left cursor-pointer text-xs"
          onClick={() => navigate(`/inventory?compartment=${node.ocid}`)}
          title={node.displayName || node.ocid}
        >
          {node.displayName || node.ocid.slice(-8)}
        </button>
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
  const { isAdmin } = useAuth();

  const [compartmentsResult] = useQuery({
    query: COMPARTMENTS_QUERY,
    variables: { snapshotId: currentSnapshot?.id || '' },
    pause: !currentSnapshot,
  });
  const compartments = compartmentsResult.data?.compartments || [];
  const tree = useMemo(() => buildTree(compartments), [compartments]);

  return (
    <aside className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 overflow-y-auto">
      <nav className="p-3 space-y-1" aria-label="Main navigation">
        {navItems.filter(item => {
          // Hide Import and Admin for viewers
          if (item.to === '/import' && !isAdmin) return false;
          if (item.to === '/admin' && !isAdmin) return false;
          return true;
        }).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
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
        <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Compartments</h3>
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
